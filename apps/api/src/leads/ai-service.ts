import OpenAI from 'openai'
import { Lead, LeadUrgency } from '../entities/Lead'
import { LeadMessage } from '../entities/LeadMessage'
import { leadConfig } from './config'
import { DocumentReadiness, LeadProfilePatch } from './types'

export const openai = leadConfig.openaiApiKey
  ? new OpenAI({ apiKey: leadConfig.openaiApiKey })
  : null

function emptyPatch(): LeadProfilePatch {
  return {
    name: null,
    email: null,
    legalArea: null,
    serviceType: null,
    caseSummary: null,
    jurisdiction: null,
    urgency: null,
    deadline: null,
    feeBudget: null,
    paymentCapacity: null,
    documentReadiness: null,
    requestedHumanHelp: false,
    meetingDecision: null,
    preferredDay: null,
    preferredTime: null,
    summary: null,
  }
}

function normalizeForMatching(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function extractMeetingPreference(message: string) {
  const lower = message.toLowerCase()
  const dayMatch = message.match(
    /\b(?:hoje|amanh[ãa]|segunda(?:-feira)?|terça(?:-feira)?|terca(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|sábado|sabado|domingo|dia\s+\d{1,2}(?:\/\d{1,2})?)\b/i,
  )
  const timeMatch = message.match(
    /(?:de\s+manh[ãa]|pela\s+manh[ãa]|manh[ãa]|[àa]\s+tarde|pela\s+tarde|tarde|[àa]\s+noite|pela\s+noite|noite|(?:[àa]s\s*)\d{1,2}(?::\d{2})?(?:\s*h(?:oras?)?)?|\d{1,2}(?::\d{2})?\s*h(?:oras?)?)/i,
  )
  const declined =
    /\b(?:n[ãa]o quero|prefiro n[ãa]o|agora n[ãa]o|deixa para depois|sem (?:reuni[ãa]o|entrevista)|n[ãa]o preciso)\b/.test(
      lower,
    )
  const affirmativeOnly = /^(?:sim|claro|pode ser|vamos|quero sim)[.!]?$/i.test(message.trim())
  const explicitMeeting = /agend|marc|reuni[ãa]o|entrevista|advogad|consultor/.test(lower)
  const accepted = !declined && (affirmativeOnly || explicitMeeting)
  return {
    meetingDecision: declined ? ('declined' as const) : accepted ? ('accepted' as const) : null,
    preferredDay: dayMatch?.[0] ?? null,
    preferredTime: timeMatch?.[0] ?? null,
  }
}

export function extractPaymentCapacityFallback(message: string) {
  const normalized = normalizeForMatching(message)
  if (/\b(?:a vista|pagamento integral|pagar tudo|valor total)\b/.test(normalized)) {
    return 'Pagamento integral'
  }
  if (/\b(?:parcel[a-z]*|prestac[a-z]*|mensal|dividir o pagamento)\b/.test(normalized)) {
    return 'Necessita parcelamento'
  }
  if (
    /\b(?:depende do valor|preciso (?:de )?orcamento|quero (?:uma )?proposta|a avaliar)\b/.test(
      normalized,
    )
  ) {
    return 'A avaliar após proposta'
  }
  return null
}

export type FeeBudgetInterpretation =
  | { kind: 'none' }
  | { kind: 'confirmed'; value: number }
  | { kind: 'ambiguous'; suggestedValue: number | null }

function parseLocalizedNumber(value: string) {
  const wordValues: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2 }
  if (wordValues[value] !== undefined) return wordValues[value]
  const normalized = value.includes(',')
    ? value.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(?:\.\d{3})+$/.test(value)
      ? value.replace(/\./g, '')
      : value
  return Number(normalized)
}

export function extractFeeBudgetInterpretation(message: string): FeeBudgetInterpretation {
  const normalized = normalizeForMatching(message)
  const scaled = normalized.match(
    /\b(\d+(?:[.,]\d+)?|um|uma|dois|duas)\s*(milhao|milhoes|mil|k|m)\b/,
  )
  if (scaled) {
    const amount = parseLocalizedNumber(scaled[1])
    const unit = scaled[2]
    if (!Number.isFinite(amount) || amount <= 0) return { kind: 'none' }
    if (unit === 'milhao' || unit === 'milhoes') {
      return { kind: 'confirmed', value: amount * 1_000_000 }
    }
    if (unit === 'm') return { kind: 'ambiguous', suggestedValue: null }
    return { kind: 'confirmed', value: amount * 1_000 }
  }

  const mentionsFees =
    /honorari|orcamento|investimento|investir|consigo pagar|posso pagar|valor|euros?|€/.test(
      normalized,
    )
  if (!mentionsFees) return { kind: 'none' }
  const bareAmount = normalized.match(/\b\d[\d.]*(?:,\d+)?\b/)?.[0]
  if (!bareAmount) return { kind: 'none' }
  const value = parseLocalizedNumber(bareAmount)
  return Number.isFinite(value) && value > 0 ? { kind: 'confirmed', value } : { kind: 'none' }
}

function extractLegalArea(message: string) {
  const normalized = normalizeForMatching(message)
  const areas: Array<[RegExp, string]> = [
    [/trabalh|emprego|demit|despedid/, 'Direito do Trabalho'],
    [/divorcio|guarda|pensao|inventario|heranca|familia/, 'Família e Sucessões'],
    [/imigr|nacionalidade|visto|residencia/, 'Imigração e Nacionalidade'],
    [/empresa|societar|acordo de socios/, 'Direito Empresarial'],
    [/contrato|cobranca|indeniz|civil/, 'Direito Civil e Contratual'],
    [/penal|criminal|crime|detid|preso/, 'Direito Penal'],
    [/tribut|fiscal|imposto/, 'Direito Tributário'],
  ]
  return areas.find(([pattern]) => pattern.test(normalized))?.[1] ?? null
}

function extractServiceType(message: string) {
  const normalized = normalizeForMatching(message)
  const services: Array<[RegExp, string]> = [
    [/divorcio/, 'Divórcio'],
    [/inventario|heranca/, 'Inventário e sucessão'],
    [/guarda|pensao/, 'Guarda ou pensão'],
    [/nacionalidade/, 'Nacionalidade'],
    [/visto|residencia/, 'Visto ou autorização de residência'],
    [/contrato/, 'Análise ou elaboração de contrato'],
    [/cobranca/, 'Cobrança'],
    [/indeniz/, 'Pedido de indemnização'],
    [/demit|despedid|trabalh/, 'Questão laboral'],
    [/consult/, 'Consulta jurídica'],
  ]
  return services.find(([pattern]) => pattern.test(normalized))?.[1] ?? null
}

function extractUrgency(message: string): LeadUrgency | null {
  const normalized = normalizeForMatching(message)
  if (/sem urgencia|nao tenho pressa|pode esperar/.test(normalized)) return 'low'
  if (/urgente|hoje|amanha|audiencia|intimac|detid|preso|prazo/.test(normalized)) return 'high'
  if (/esta semana|proximos dias|em breve/.test(normalized)) return 'medium'
  return null
}

function extractDeadline(message: string) {
  const normalized = normalizeForMatching(message)
  if (/sem prazo|nao (?:ha|tenho|existe) prazo|nenhum prazo/.test(normalized)) {
    return 'Sem prazo informado'
  }
  return (
    message.match(
      /\b(?:hoje|amanh[ãa]|esta semana|dia\s+\d{1,2}(?:\/\d{1,2}(?:\/\d{2,4})?)?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/i,
    )?.[0] ?? null
  )
}

function extractDocumentReadiness(message: string): DocumentReadiness | null {
  const normalized = normalizeForMatching(message)
  if (/nao tenho (?:nenhum |os )?document|sem document/.test(normalized)) return 'none'
  if (
    /tenho (?:todos|toda a documentacao)|documentacao completa|documentos completos/.test(
      normalized,
    )
  )
    return 'complete'
  if (
    /tenho (?:alguns|parte dos) document|documentacao parcial|falta[m ]+document/.test(normalized)
  )
    return 'partial'
  return null
}

function fallbackExtraction(message: string): LeadProfilePatch {
  const normalized = normalizeForMatching(message)
  const patch = { ...emptyPatch(), ...extractMeetingPreference(message), summary: message }
  const feeBudget = extractFeeBudgetInterpretation(message)
  patch.feeBudget = feeBudget.kind === 'confirmed' ? feeBudget.value : null
  patch.email = message.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0] ?? null
  patch.name =
    message.match(/\b(?:me chamo|meu nome [ée]|sou)\s+([\p{L}][\p{L}' -]{1,60})/iu)?.[1]?.trim() ??
    null
  patch.legalArea = extractLegalArea(message)
  patch.serviceType = extractServiceType(message)
  patch.jurisdiction =
    message.match(/\b(?:Portugal|Brasil|Lisboa|Porto|Braga|Coimbra|Faro|Setúbal|Aveiro)\b/i)?.[0] ??
    null
  patch.urgency = extractUrgency(message)
  patch.deadline = extractDeadline(message)
  patch.documentReadiness = extractDocumentReadiness(message)
  patch.paymentCapacity = extractPaymentCapacityFallback(message)
  patch.requestedHumanHelp =
    /advogad|consultor|humano|reuni[ãa]o|entrevista|agend|marcar hor[áa]rio/.test(normalized)
  if (
    patch.legalArea ||
    patch.serviceType ||
    /processo|problema|situacao|caso|preciso de ajuda/.test(normalized)
  ) {
    patch.caseSummary = message
  }
  return patch
}

function sanitizeExtractedPatch(value: unknown, fallback: LeadProfilePatch): LeadProfilePatch {
  if (!value || typeof value !== 'object') return fallback
  const source = value as Record<string, unknown>
  const urgencyValues: LeadUrgency[] = ['low', 'medium', 'high']
  const readinessValues: DocumentReadiness[] = ['none', 'partial', 'complete']
  const meetingValues = ['accepted', 'declined'] as const
  const feeBudget = Number(source.feeBudget)

  return {
    name: nullableString(source.name) ?? fallback.name,
    email: nullableString(source.email) ?? fallback.email,
    legalArea: nullableString(source.legalArea) ?? fallback.legalArea,
    serviceType: nullableString(source.serviceType) ?? fallback.serviceType,
    caseSummary: nullableString(source.caseSummary) ?? fallback.caseSummary,
    jurisdiction: nullableString(source.jurisdiction) ?? fallback.jurisdiction,
    urgency: urgencyValues.includes(source.urgency as LeadUrgency)
      ? (source.urgency as LeadUrgency)
      : fallback.urgency,
    deadline: nullableString(source.deadline) ?? fallback.deadline,
    feeBudget: Number.isFinite(feeBudget) && feeBudget > 0 ? feeBudget : fallback.feeBudget,
    paymentCapacity: nullableString(source.paymentCapacity) ?? fallback.paymentCapacity,
    documentReadiness: readinessValues.includes(source.documentReadiness as DocumentReadiness)
      ? (source.documentReadiness as DocumentReadiness)
      : fallback.documentReadiness,
    requestedHumanHelp: source.requestedHumanHelp === true || fallback.requestedHumanHelp,
    meetingDecision: meetingValues.includes(source.meetingDecision as 'accepted' | 'declined')
      ? (source.meetingDecision as 'accepted' | 'declined')
      : fallback.meetingDecision,
    preferredDay: nullableString(source.preferredDay) ?? fallback.preferredDay,
    preferredTime: nullableString(source.preferredTime) ?? fallback.preferredTime,
    summary: nullableString(source.summary) ?? fallback.summary,
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('OpenAI request timed out')), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function extractLeadProfile(lead: Lead, messages: LeadMessage[], latest: string) {
  const fallback = fallbackExtraction(latest)
  if (!openai) return fallback
  try {
    const response = await withTimeout(
      openai.chat.completions.create({
        model: leadConfig.openaiModel,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Extraia somente informações explícitas para triagem comercial de um serviço jurídico e preferência de entrevista. Retorne JSON camelCase com name, email, legalArea, serviceType, caseSummary, jurisdiction, urgency (low, medium, high ou null), deadline como texto explícito, feeBudget numérico em EUR, paymentCapacity, documentReadiness (none, partial, complete ou null), requestedHumanHelp, meetingDecision (accepted, declined ou null), preferredDay, preferredTime e summary. Não conclua mérito jurídico, prazo legal, estratégia ou probabilidade de êxito. Use null ou false quando ausente.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              knownProfile: {
                name: lead.name,
                legalArea: lead.legalArea,
                serviceType: lead.serviceType,
                caseSummary: lead.caseSummary,
                jurisdiction: lead.jurisdiction,
                urgency: lead.urgency,
                deadline: lead.deadline,
                feeBudget: lead.feeBudget,
                paymentCapacity: lead.paymentCapacity,
                documentReadiness: lead.documentReadiness,
              },
              messages: messages.slice(-10).map((message) => ({
                sender: message.senderType,
                content: message.content,
              })),
              latest,
            }),
          },
        ],
      }),
      leadConfig.llmTimeoutMs,
    )
    const content = response.choices[0]?.message.content
    if (!content) return fallback
    const extracted = sanitizeExtractedPatch(JSON.parse(content), fallback)
    const feeBudget = extractFeeBudgetInterpretation(latest)
    if (feeBudget.kind === 'confirmed') extracted.feeBudget = feeBudget.value
    if (feeBudget.kind === 'ambiguous') extracted.feeBudget = null
    return extracted
  } catch (error) {
    console.error('Lead extraction failed, using fallback', error)
    return fallback
  }
}
