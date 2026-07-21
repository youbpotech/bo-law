import { Lead } from '../entities/Lead'
import { LeadMessage } from '../entities/LeadMessage'
import {
  LeadConversationProfile,
  MeetingStage,
  QualificationField,
  QualificationLead,
} from './types'

export const WELCOME_MESSAGE =
  'Olá! Sou o assistente virtual do escritório. Que bom ter você por aqui.'
export const HUMAN_HANDOFF_REPLY =
  'Entendido. Vou encaminhar sua conversa para um profissional do escritório. Se houver risco imediato, audiência, detenção, intimação ou prazo próximo, procure atendimento jurídico urgente; esta mensagem não confirma disponibilidade nem calcula prazos.'

export type ConversationPhase =
  | 'qualification'
  | 'meeting_preference'
  | 'awaiting_professional'
  | 'declined'

export type AgentContext = {
  firstContact: boolean
  phase: ConversationPhase
  knownProfile: {
    name: string | null
    legalArea: string | null
    serviceType: string | null
    caseSummary: string | null
    jurisdiction: string | null
    urgency: string | null
    deadline: string | null
    feeBudget: number | null
    paymentCapacity: string | null
    documentReadiness: string | null
  }
  missingFields: QualificationField[]
  askedProfileFields: QualificationField[]
  customerNeedsGuidance: boolean
  questionGoal: string | null
  requestedHumanHelp: boolean
  meeting: Pick<LeadConversationProfile, 'meetingStage' | 'preferredDay' | 'preferredTime'>
  recentMessages: Array<{ sender: 'lead' | 'bot' | 'human'; content: string }>
}

export type MeetingFact = {
  key:
    | 'legalArea'
    | 'serviceType'
    | 'jurisdiction'
    | 'urgency'
    | 'deadline'
    | 'feeBudget'
    | 'documentReadiness'
  formattedValue: string
  phrase: string
}

const qualificationOrder: QualificationField[] = [
  'name',
  'legalArea',
  'serviceType',
  'caseSummary',
  'jurisdiction',
  'urgency',
  'deadline',
  'documentReadiness',
  'feeBudget',
  'paymentCapacity',
]

const questionGoals: Record<QualificationField, string> = {
  name: 'Pergunte como a pessoa gostaria de ser chamada.',
  legalArea:
    'Pergunte qual é o tema geral da necessidade jurídica, sem exigir que a pessoa saiba classificar a área do Direito.',
  serviceType:
    'Pergunte que tipo de apoio ela procura, por exemplo consulta, análise documental, elaboração de documento ou acompanhamento.',
  caseSummary:
    'Peça um resumo breve dos fatos e do resultado que a pessoa busca, sem solicitar documentos ou dados excessivamente sensíveis.',
  jurisdiction: 'Pergunte em qual país ou localidade a situação ocorreu ou deverá ser tratada.',
  urgency:
    'Pergunte se existe urgência operacional, audiência, intimação ou outro prazo já comunicado, sem calcular prazo legal.',
  deadline:
    'Pergunte qual é a data ou descrição exata do prazo comunicado; se não houver prazo, registre essa informação explicitamente.',
  documentReadiness:
    'Pergunte se a pessoa já possui os documentos relacionados ao caso, parcialmente ou por completo.',
  feeBudget:
    'Pergunte qual faixa de investimento em honorários ela considera viável, deixando claro que o escritório ainda fará uma proposta.',
  paymentCapacity:
    'Pergunte se prefere pagamento integral, parcelado ou se precisa avaliar após receber uma proposta.',
}

const guidanceGoals: Record<QualificationField, string> = {
  name: 'Responda brevemente ao assunto trazido e pergunte de forma natural como a pessoa gostaria de ser chamada.',
  legalArea:
    'Diga que ela não precisa classificar juridicamente o caso; peça apenas o tema principal, sem dar diagnóstico.',
  serviceType:
    'Explique que o escritório pode inicialmente avaliar necessidades como consulta, documento ou acompanhamento e pergunte qual apoio ela imagina precisar.',
  caseSummary:
    'Explique que basta um resumo dos fatos principais, evitando dados desnecessários, e peça que conte o que ocorreu e o que espera resolver.',
  jurisdiction:
    'Explique que a localidade ajuda a encaminhar o atendimento e pergunte onde a situação ocorreu ou será tratada.',
  urgency:
    'Explique que urgências e comunicações oficiais devem ser vistas por um profissional e pergunte se há data, audiência ou intimação já informada.',
  deadline:
    'Explique que o sistema só registrará a data informada, sem calcular prazo jurídico, e pergunte qual data ou indicação de ausência de prazo foi comunicada.',
  documentReadiness:
    'Explique que uma indicação geral é suficiente nesta etapa e pergunte se possui nenhum, alguns ou todos os documentos relacionados.',
  feeBudget:
    'Explique que os honorários dependem da análise humana e pergunte apenas qual faixa seria viável, sem inventar preços.',
  paymentCapacity:
    'Explique que condições serão definidas em proposta e pergunte se a preferência inicial seria pagamento integral, parcelamento ou avaliação posterior.',
}

const fallbackQuestions: Record<QualificationField, string> = {
  name: 'Como você gostaria de ser chamado?',
  legalArea: 'Qual é o tema principal da ajuda jurídica que você procura?',
  serviceType:
    'Você procura uma consulta, análise ou elaboração de documento, ou acompanhamento do caso?',
  caseSummary: 'Em poucas palavras, o que aconteceu e o que você precisa resolver?',
  jurisdiction: 'Em qual país ou localidade essa situação ocorreu ou deverá ser tratada?',
  urgency: 'Existe alguma urgência, audiência, intimação ou data já comunicada?',
  deadline:
    'Qual é a data ou prazo que foi comunicado? Se não houver, pode dizer “sem prazo informado”.',
  documentReadiness: 'Você já tem os documentos relacionados ao caso: nenhum, alguns ou todos?',
  feeBudget:
    'Qual faixa de investimento em honorários seria viável para você, mesmo que aproximada?',
  paymentCapacity: 'Você prefere pagamento integral, parcelado ou avaliar isso depois da proposta?',
}

const guidanceFallbacks: Record<QualificationField, string> = {
  name: 'Posso ajudar a organizar as informações para o atendimento. Para conversarmos de forma mais próxima, como você gostaria de ser chamado?',
  legalArea:
    'Você não precisa saber o nome jurídico da área. Basta me dizer se o assunto envolve, por exemplo, trabalho, família, contrato, imigração, empresa ou outra situação. Qual é o tema principal?',
  serviceType:
    'Não precisa definir isso tecnicamente agora. O atendimento pode começar por uma consulta, análise de documentos, elaboração de um documento ou acompanhamento mais amplo. Qual dessas necessidades mais se aproxima da sua?',
  caseSummary:
    'Nesta etapa basta um resumo, sem enviar dados ou documentos sensíveis: conte o fato principal e o que espera resolver. O que aconteceu?',
  jurisdiction:
    'A localidade serve apenas para encaminhar corretamente a entrevista, sem antecipar qualquer conclusão jurídica. Onde a situação ocorreu ou deverá ser tratada?',
  urgency:
    'Se houver audiência, intimação ou risco imediato, o ideal é falar com um profissional o quanto antes. Há alguma data ou comunicação oficial já informada?',
  deadline:
    'Vou apenas registrar o que foi comunicado, sem calcular prazo jurídico. Qual data foi informada, ou não existe prazo conhecido?',
  documentReadiness:
    'Uma indicação geral é suficiente agora; não precisa enviar arquivos. Você possui nenhum, alguns ou todos os documentos ligados à situação?',
  feeBudget:
    'Os honorários só poderão ser definidos depois da análise do escritório. Para orientar a proposta, qual faixa de investimento seria viável para você?',
  paymentCapacity:
    'As condições serão apresentadas formalmente pelo escritório. Inicialmente, você imagina pagamento integral, parcelamento ou prefere avaliar depois da proposta?',
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function readConversationProfile(lead: Pick<Lead, 'profile'>): LeadConversationProfile {
  const source = lead.profile ?? {}
  const validStages: MeetingStage[] = [
    'not_offered',
    'collecting_preference',
    'requested',
    'declined',
  ]
  const meetingStage = validStages.includes(source.meetingStage as MeetingStage)
    ? (source.meetingStage as MeetingStage)
    : 'not_offered'
  const askedProfileFields = Array.isArray(source.askedProfileFields)
    ? source.askedProfileFields.filter((field): field is QualificationField =>
        qualificationOrder.includes(field as QualificationField),
      )
    : []
  const pendingFeeBudgetConfirmation = Number(source.pendingFeeBudgetConfirmation)

  return {
    meetingStage,
    preferredDay: stringValue(source.preferredDay),
    preferredTime: stringValue(source.preferredTime),
    meetingPreferenceRaw: stringValue(source.meetingPreferenceRaw),
    askedProfileFields: [...new Set(askedProfileFields)],
    activeGuidanceField: qualificationOrder.includes(
      source.activeGuidanceField as QualificationField,
    )
      ? (source.activeGuidanceField as QualificationField)
      : null,
    profileRecapSent: source.profileRecapSent === true,
    pendingFeeBudgetConfirmation:
      Number.isFinite(pendingFeeBudgetConfirmation) && pendingFeeBudgetConfirmation > 0
        ? pendingFeeBudgetConfirmation
        : null,
  }
}

export function missingQualificationFields(lead: QualificationLead) {
  return qualificationOrder.filter((field) => !lead[field])
}

export function isReadyForMeeting(lead: QualificationLead & Pick<Lead, 'phone'>) {
  return Boolean(lead.phone) && missingQualificationFields(lead).length === 0
}

export function selectNextQualificationField(
  lead: QualificationLead,
  askedFields: QualificationField[],
  latestMessage?: string,
  activeGuidanceField?: QualificationField | null,
) {
  const missing = missingQualificationFields(lead)
  if (activeGuidanceField && missing.includes(activeGuidanceField)) return activeGuidanceField
  const lastAskedField = askedFields.at(-1)
  if (
    latestMessage &&
    lastAskedField &&
    missing.includes(lastAskedField) &&
    messageRequestsGuidance(latestMessage)
  ) {
    return lastAskedField
  }
  return missing.find((field) => !askedFields.includes(field)) ?? missing[0] ?? null
}

export function messageRequestsGuidance(message: string) {
  const normalized = message
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  return (
    /\b(?:nao sei|nao tenho (?:certeza|preferencia)|ainda nao decidi|estou em duvida|tenho duvida)\b/.test(
      normalized,
    ) ||
    /\b(?:sugest[a-z]*|recomend[a-z]*|indic[a-z]*|orient[a-z]*|(?:me |pode me )?ajud[a-z]*|o que voce acha|qual (?:e |seria )?melhor)\b/.test(
      normalized,
    )
  )
}

export function buildAgentContext(
  lead: Lead,
  messages: LeadMessage[],
  nextField: QualificationField | null,
  firstContact = false,
): AgentContext {
  const conversation = readConversationProfile(lead)
  const latestLeadMessage = [...messages]
    .reverse()
    .find((message) => message.senderType === 'lead')?.content
  const customerNeedsGuidance =
    Boolean(nextField) &&
    (conversation.activeGuidanceField === nextField ||
      Boolean(latestLeadMessage && messageRequestsGuidance(latestLeadMessage)))
  const phase: ConversationPhase =
    conversation.meetingStage === 'collecting_preference'
      ? 'meeting_preference'
      : conversation.meetingStage === 'requested'
        ? 'awaiting_professional'
        : conversation.meetingStage === 'declined'
          ? 'declined'
          : 'qualification'

  return {
    firstContact,
    phase,
    knownProfile: {
      name: lead.name,
      legalArea: lead.legalArea,
      serviceType: lead.serviceType,
      caseSummary: lead.caseSummary,
      jurisdiction: lead.jurisdiction,
      urgency: lead.urgency,
      deadline: lead.deadline,
      feeBudget: lead.feeBudget ? Number(lead.feeBudget) : null,
      paymentCapacity: lead.paymentCapacity,
      documentReadiness: lead.documentReadiness,
    },
    missingFields: missingQualificationFields(lead),
    askedProfileFields: conversation.askedProfileFields,
    customerNeedsGuidance,
    questionGoal: nextField
      ? customerNeedsGuidance
        ? guidanceGoals[nextField]
        : questionGoals[nextField]
      : null,
    requestedHumanHelp: lead.requestedHumanHelp,
    meeting: {
      meetingStage: conversation.meetingStage,
      preferredDay: conversation.preferredDay,
      preferredTime: conversation.preferredTime,
    },
    recentMessages: messages.slice(-10).map((message) => ({
      sender: message.senderType,
      content: message.content,
    })),
  }
}

function fallbackBridge(field: QualificationField, lead?: QualificationLead) {
  if (!lead) return 'Obrigado por compartilhar. Isso já ajuda a organizar o atendimento.'

  switch (field) {
    case 'name':
      return 'Quero entender o essencial para encaminhar seu atendimento.'
    case 'legalArea':
      return lead.name
        ? `Prazer, ${sanitizeWhatsappValue(lead.name)}. Vamos organizar sua necessidade.`
        : 'Obrigado por explicar o contato inicial.'
    case 'serviceType':
      return lead.legalArea
        ? `Registrei o tema como ${sanitizeWhatsappValue(lead.legalArea)}.`
        : 'Já consigo direcionar melhor o assunto.'
    case 'caseSummary':
      return 'Agora preciso apenas do contexto principal, sem documentos ou detalhes excessivamente sensíveis.'
    case 'jurisdiction':
      return 'Esse resumo ajuda o escritório a preparar a entrevista.'
    case 'urgency':
      return 'A localidade já ajuda no encaminhamento inicial.'
    case 'deadline':
      return 'Obrigado. Registrei a informação de prazo sem fazer qualquer cálculo jurídico.'
    case 'documentReadiness':
      return 'Obrigado. Também é útil saber como está a documentação neste momento.'
    case 'feeBudget':
      return 'Estamos quase concluindo a triagem comercial.'
    case 'paymentCapacity':
      return 'Falta apenas entender a preferência inicial para uma eventual proposta.'
  }
}

export function buildQualificationFallback(
  field: QualificationField | null,
  lead?: QualificationLead,
  customerNeedsGuidance = false,
) {
  if (field && customerNeedsGuidance) return guidanceFallbacks[field]
  return field ? `${fallbackBridge(field, lead)} ${fallbackQuestions[field]}` : AGENT_FAILURE_REPLY
}

export function withFirstContactIntroduction(reply: string) {
  return `${WELCOME_MESSAGE} ${reply}`
}

export function sanitizeWhatsappValue(value: string) {
  return value
    .replace(/[*_~`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function bold(value: string) {
  return `*${sanitizeWhatsappValue(value)}*`
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value)
}

export function buildFeeBudgetClarificationReply(suggestedValue: number | null) {
  if (suggestedValue) {
    return `Só para registrar corretamente: você quis dizer uma faixa de aproximadamente *${sanitizeWhatsappValue(formatMoney(suggestedValue))}* para honorários?`
  }
  return 'Só para registrar corretamente: qual faixa aproximada de honorários você quis indicar, em euros? O valor final dependerá da análise e da proposta do escritório.'
}

function readinessLabel(value: string) {
  if (value === 'complete') return 'documentação completa'
  if (value === 'partial') return 'parte da documentação disponível'
  if (value === 'none') return 'documentação ainda não reunida'
  return value
}

export function selectMeetingFacts(
  lead: Pick<
    Lead,
    | 'legalArea'
    | 'serviceType'
    | 'jurisdiction'
    | 'urgency'
    | 'deadline'
    | 'feeBudget'
    | 'documentReadiness'
  >,
): MeetingFact[] {
  const facts: Array<MeetingFact | null> = [
    lead.legalArea
      ? {
          key: 'legalArea',
          formattedValue: bold(lead.legalArea),
          phrase: `tema de ${bold(lead.legalArea)}`,
        }
      : null,
    lead.serviceType
      ? {
          key: 'serviceType',
          formattedValue: bold(lead.serviceType),
          phrase: `apoio em ${bold(lead.serviceType)}`,
        }
      : null,
    lead.jurisdiction
      ? {
          key: 'jurisdiction',
          formattedValue: bold(lead.jurisdiction),
          phrase: `situação relacionada a ${bold(lead.jurisdiction)}`,
        }
      : null,
    lead.urgency
      ? {
          key: 'urgency',
          formattedValue: bold(lead.urgency),
          phrase: `urgência indicada como ${bold(lead.urgency)}`,
        }
      : null,
    lead.deadline
      ? {
          key: 'deadline',
          formattedValue: bold(lead.deadline),
          phrase: `data informada: ${bold(lead.deadline)}`,
        }
      : null,
    lead.feeBudget
      ? {
          key: 'feeBudget',
          formattedValue: bold(formatMoney(Number(lead.feeBudget))),
          phrase: `faixa de honorários de ${bold(formatMoney(Number(lead.feeBudget)))}`,
        }
      : null,
    lead.documentReadiness
      ? {
          key: 'documentReadiness',
          formattedValue: bold(readinessLabel(lead.documentReadiness)),
          phrase: bold(readinessLabel(lead.documentReadiness)),
        }
      : null,
  ]
  return facts.filter((fact): fact is MeetingFact => Boolean(fact)).slice(0, 4)
}

function joinNaturally(values: string[]) {
  if (values.length < 2) return values[0] ?? ''
  return `${values.slice(0, -1).join(', ')} e ${values.at(-1)}`
}

type MeetingLead = Pick<
  Lead,
  | 'name'
  | 'legalArea'
  | 'serviceType'
  | 'jurisdiction'
  | 'urgency'
  | 'deadline'
  | 'feeBudget'
  | 'documentReadiness'
>

export function buildMeetingTransitionFallback(lead: MeetingLead) {
  const name = lead.name ? `${sanitizeWhatsappValue(lead.name)}, ` : ''
  const facts = selectMeetingFacts(lead)
  const recap = facts.length
    ? `pelo que você compartilhou, registrei ${joinNaturally(facts.map((fact) => fact.phrase))}. `
    : ''
  return `${name}${recap}O próximo passo é uma entrevista com um profissional do escritório para avaliar o atendimento. Qual dia e horário funcionam melhor para você?`
}

export function buildMeetingPreferenceReply(lead: Pick<Lead, 'name'>, day: string, time: string) {
  const name = lead.name ? `, ${sanitizeWhatsappValue(lead.name)}` : ''
  return `Obrigado${name}. Registrei sua preferência para *${sanitizeWhatsappValue(day)}*, às *${sanitizeWhatsappValue(time)}*. O escritório entrará em contato para confirmar a disponibilidade.`
}

export function buildMissingPreferenceReply(day: string | null, time: string | null) {
  if (!day && !time) return 'Qual dia e horário funcionam melhor para a entrevista?'
  if (!day) return 'Qual dia funciona melhor para a entrevista?'
  if (!time) return `E qual horário você prefere em *${sanitizeWhatsappValue(day)}*?`
  return ''
}

export function buildMeetingRequestWithPreferenceReply(
  lead: MeetingLead,
  day: string,
  time: string,
) {
  const transition = buildMeetingTransitionFallback(lead).replace(
    /Qual dia e horário funcionam melhor para você\?$/,
    '',
  )
  return `${transition} Registrei sua preferência para *${sanitizeWhatsappValue(day)}*, às *${sanitizeWhatsappValue(time)}*. O escritório entrará em contato para confirmar a disponibilidade.`
}

export const MEETING_DECLINED_REPLY =
  'Sem problema. Quando quiser conversar com um profissional do escritório, é só me avisar por aqui.'
export const AGENT_FAILURE_REPLY =
  'Desculpe, tive uma instabilidade agora. Pode me mandar essa informação mais uma vez?'
