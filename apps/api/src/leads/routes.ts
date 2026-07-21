import { Request, Response, Router } from 'express'
import { requireCurrentUser } from '../auth/current-user'
import { requireAuth } from '../auth/middleware'
import { AppDataSource } from '../data-source'
import { Client } from '../entities/Client'
import { Company } from '../entities/Company'
import {
  ConversationStatus,
  LeadSalesStage,
  LeadSourceChannel,
  LeadUrgency,
  QualificationLevel,
} from '../entities/Lead'
import {
  audioFailedContent,
  audioPendingContent,
  createAudioJob,
  parseInboundAudio,
} from './audio-service'
import { leadConfig } from './config'
import { processInboundMessage } from './conversation-service'
import {
  createLead,
  findOrCreateLeadByPhone,
  getLeadDetail,
  getLeadById,
  isValidSalesStageTransition,
  listLeads,
  setLeadConversationStatus,
  updateLastMessage,
  updateLead,
} from './lead-service'
import {
  createInboundMessageIdempotently,
  createMessage,
  listMessagesForLead,
  updateMessageTwilioSid,
} from './message-service'
import { CreateLeadInput, DocumentReadiness, UpdateLeadInput } from './types'
import {
  emptyTwiml,
  normalizeWhatsappPhone,
  sendWhatsappMessage,
  validateTwilioRequest,
} from './twilio-service'

export const leadsRouter = Router()
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CONVERSATION_STATUSES: ConversationStatus[] = ['bot_active', 'awaiting_human', 'human_active']
const QUALIFICATION_LEVELS: QualificationLevel[] = ['frio', 'morno', 'quente']
const SALES_STAGES: LeadSalesStage[] = [
  'new',
  'interview_scheduled',
  'interview_completed',
  'nurturing',
  'contracted',
  'lost',
]
const SOURCE_CHANNELS: LeadSourceChannel[] = ['partners', 'lives', 'referrals', 'website', 'other']
const URGENCY_LEVELS: LeadUrgency[] = ['low', 'medium', 'high']
const DOCUMENT_READINESS_VALUES: DocumentReadiness[] = ['none', 'partial', 'complete']

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function nullableText(value: unknown) {
  const normalized = normalizeText(value)
  return normalized || null
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  )
}

function parseNullableDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'string') return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function buildLeadInput(
  body: Record<string, unknown>,
  requirePhone: true,
): { input?: CreateLeadInput; error?: string }
function buildLeadInput(
  body: Record<string, unknown>,
  requirePhone: false,
): { input?: UpdateLeadInput; error?: string }
function buildLeadInput(
  body: Record<string, unknown>,
  requirePhone: boolean,
): { input?: CreateLeadInput | UpdateLeadInput; error?: string } {
  const input: UpdateLeadInput = {}
  const phoneProvided = body.phone !== undefined
  const phone = normalizeWhatsappPhone(normalizeText(body.phone))

  if ((requirePhone || phoneProvided) && !phone) return { error: 'Telefone é obrigatório' }
  if (phoneProvided || requirePhone) input.phone = phone

  const nullableFields = [
    'email',
    'name',
    'legalArea',
    'serviceType',
    'caseSummary',
    'jurisdiction',
    'deadline',
    'paymentCapacity',
  ] as const
  for (const field of nullableFields) {
    if (body[field] !== undefined) input[field] = nullableText(body[field])
  }

  if (body.clientId !== undefined) {
    const clientId = nullableText(body.clientId)
    if (clientId && !UUID.test(clientId)) return { error: 'Cliente inválido' }
    input.clientId = clientId
  }
  if (body.sourceChannel !== undefined) {
    if (!SOURCE_CHANNELS.includes(body.sourceChannel as LeadSourceChannel)) {
      return { error: 'Canal de origem inválido' }
    }
    input.sourceChannel = body.sourceChannel as LeadSourceChannel
  }
  if (body.urgency !== undefined) {
    if (body.urgency !== null && !URGENCY_LEVELS.includes(body.urgency as LeadUrgency)) {
      return { error: 'Urgência inválida' }
    }
    input.urgency = body.urgency as LeadUrgency | null
  }
  if (body.documentReadiness !== undefined) {
    if (
      body.documentReadiness !== null &&
      !DOCUMENT_READINESS_VALUES.includes(body.documentReadiness as DocumentReadiness)
    ) {
      return { error: 'Situação documental inválida' }
    }
    input.documentReadiness = body.documentReadiness as DocumentReadiness | null
  }
  if (body.feeBudget !== undefined) {
    if (body.feeBudget === null || body.feeBudget === '') {
      input.feeBudget = null
    } else {
      const feeBudget = Number(body.feeBudget)
      if (!Number.isFinite(feeBudget) || feeBudget <= 0)
        return { error: 'Orçamento de honorários inválido' }
      input.feeBudget = feeBudget
    }
  }
  if (body.requestedHumanHelp !== undefined) {
    if (typeof body.requestedHumanHelp !== 'boolean')
      return { error: 'Pedido de atendimento humano inválido' }
    input.requestedHumanHelp = body.requestedHumanHelp
  }
  if (body.conversationStatus !== undefined) {
    if (!CONVERSATION_STATUSES.includes(body.conversationStatus as ConversationStatus)) {
      return { error: 'Estado da conversa inválido' }
    }
    input.conversationStatus = body.conversationStatus as ConversationStatus
  }
  if (body.salesStage !== undefined) {
    if (!SALES_STAGES.includes(body.salesStage as LeadSalesStage)) {
      return { error: 'Etapa comercial inválida' }
    }
    input.salesStage = body.salesStage as LeadSalesStage
  }

  for (const field of ['interviewAt', 'rehydrateAt'] as const) {
    const parsed = parseNullableDate(body[field])
    if (body[field] !== undefined && parsed === undefined) return { error: 'Data inválida' }
    if (parsed !== undefined) input[field] = parsed
  }

  return { input: input as CreateLeadInput | UpdateLeadInput }
}

async function clientBelongsToCompany(clientId: string | null | undefined, companyId: number) {
  if (!clientId) return true
  return Boolean(await AppDataSource.getRepository(Client).findOneBy({ id: clientId, companyId }))
}

async function resolveWebhookCompanyId(to: string): Promise<number | null> {
  const normalizedTo = normalizeWhatsappPhone(to.trim())
  if (normalizedTo) {
    const company = await AppDataSource.getRepository(Company).findOne({
      where: [
        { whatsappNumber: normalizedTo },
        { whatsappNumber: `whatsapp:${normalizedTo}` },
        { whatsappNumber: to.trim() },
      ],
    })
    if (company) return company.id
  }

  const fallbackId = Number(process.env.LEADS_DEFAULT_COMPANY_ID)
  if (!Number.isInteger(fallbackId) || fallbackId <= 0) return null
  const fallbackCompany = await AppDataSource.getRepository(Company).findOneBy({ id: fallbackId })
  return fallbackCompany?.id ?? null
}

leadsRouter.get('/leads', requireAuth, async (req, res) => {
  const currentUser = await requireCurrentUser(req, res)
  if (!currentUser) return

  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25))
  const rawConversationStatus = req.query.conversationStatus ?? req.query.status
  const rawQualificationLevel = req.query.qualificationLevel ?? req.query.level
  const conversationStatus = CONVERSATION_STATUSES.includes(
    rawConversationStatus as ConversationStatus,
  )
    ? (rawConversationStatus as ConversationStatus)
    : undefined
  const qualificationLevel = QUALIFICATION_LEVELS.includes(
    rawQualificationLevel as QualificationLevel,
  )
    ? (rawQualificationLevel as QualificationLevel)
    : undefined
  const salesStage = SALES_STAGES.includes(req.query.salesStage as LeadSalesStage)
    ? (req.query.salesStage as LeadSalesStage)
    : undefined

  res.json(
    await listLeads({
      companyId: currentUser.companyId,
      page,
      limit,
      conversationStatus,
      qualificationLevel,
      salesStage,
      search: normalizeText(req.query.search) || undefined,
    }),
  )
})

leadsRouter.post('/leads', requireAuth, async (req, res) => {
  const currentUser = await requireCurrentUser(req, res)
  if (!currentUser) return
  const parsed = buildLeadInput(req.body as Record<string, unknown>, true)
  if (!parsed.input) return res.status(400).json({ error: parsed.error })
  if (parsed.input.salesStage && parsed.input.salesStage !== 'new') {
    return res.status(400).json({ error: 'Novos leads devem iniciar na etapa comercial Novo' })
  }
  if (!(await clientBelongsToCompany(parsed.input.clientId, currentUser.companyId))) {
    return res.status(400).json({ error: 'Cliente não encontrado na empresa atual' })
  }
  try {
    return res.status(201).json(await createLead(currentUser.companyId, parsed.input))
  } catch (error) {
    if (isUniqueViolation(error))
      return res.status(409).json({ error: 'Telefone já cadastrado nesta empresa' })
    throw error
  }
})

leadsRouter.get('/leads/:id', requireAuth, async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Lead inválido' })
  const currentUser = await requireCurrentUser(req, res)
  if (!currentUser) return
  const lead = await getLeadDetail(currentUser.companyId, req.params.id)
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' })
  const messages = await listMessagesForLead(lead.id)
  const { legalCase, ...leadPayload } = lead
  return res.json({ lead: leadPayload, messages, legalCase: legalCase ?? null })
})

leadsRouter.patch('/leads/:id', requireAuth, async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Lead inválido' })
  const currentUser = await requireCurrentUser(req, res)
  if (!currentUser) return
  const existingLead = await getLeadById(currentUser.companyId, req.params.id)
  if (!existingLead) return res.status(404).json({ error: 'Lead não encontrado' })
  const parsed = buildLeadInput(req.body as Record<string, unknown>, false)
  if (!parsed.input) return res.status(400).json({ error: parsed.error })
  if (!(await clientBelongsToCompany(parsed.input.clientId, currentUser.companyId))) {
    return res.status(400).json({ error: 'Cliente não encontrado na empresa atual' })
  }
  if (parsed.input.salesStage === 'contracted' && existingLead.salesStage !== 'contracted') {
    return res
      .status(400)
      .json({ error: 'A contratação deve ser realizada pelo fluxo de conversão' })
  }
  if (
    parsed.input.salesStage &&
    parsed.input.salesStage !== existingLead.salesStage &&
    !isValidSalesStageTransition(existingLead.salesStage, parsed.input.salesStage)
  ) {
    return res.status(400).json({ error: 'Transição de etapa comercial inválida' })
  }
  if (
    parsed.input.salesStage === 'interview_scheduled' &&
    parsed.input.interviewAt === undefined &&
    !existingLead.interviewAt
  ) {
    return res.status(400).json({ error: 'Informe a data da entrevista' })
  }
  if (parsed.input.salesStage === 'interview_scheduled' && parsed.input.interviewAt === null) {
    return res.status(400).json({ error: 'Informe a data da entrevista' })
  }
  if (
    parsed.input.salesStage === 'interview_scheduled' &&
    parsed.input.interviewAt &&
    parsed.input.interviewAt.getTime() <= Date.now()
  ) {
    return res.status(400).json({ error: 'A entrevista deve ser agendada para uma data futura' })
  }
  if (parsed.input.salesStage === 'nurturing' && !parsed.input.rehydrateAt) {
    const rehydrateAt = new Date()
    rehydrateAt.setUTCDate(rehydrateAt.getUTCDate() + 30)
    parsed.input.rehydrateAt = rehydrateAt
  }

  try {
    const lead = await updateLead(currentUser.companyId, req.params.id, parsed.input)
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' })
    return res.json(lead)
  } catch (error) {
    if (isUniqueViolation(error))
      return res.status(409).json({ error: 'Telefone já cadastrado nesta empresa' })
    throw error
  }
})

leadsRouter.post('/leads/:id/assume', requireAuth, async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Lead inválido' })
  const currentUser = await requireCurrentUser(req, res)
  if (!currentUser) return
  const lead = await setLeadConversationStatus(currentUser.companyId, req.params.id, 'human_active')
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' })
  return res.json(lead)
})

leadsRouter.post('/leads/:id/send-message', requireAuth, async (req, res) => {
  const content = normalizeText(req.body.content)
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Lead inválido' })
  if (!content) return res.status(400).json({ error: 'Informe a mensagem' })
  const currentUser = await requireCurrentUser(req, res)
  if (!currentUser) return
  const lead = await getLeadById(currentUser.companyId, req.params.id)
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' })
  const fallbackCompanyId = Number(process.env.LEADS_DEFAULT_COMPANY_ID)
  const whatsappFrom =
    currentUser.company.whatsappNumber ||
    (fallbackCompanyId === currentUser.companyId ? leadConfig.twilioWhatsappFrom : '')
  if (!whatsappFrom) {
    return res.status(409).json({
      error: 'Configure o número de WhatsApp desta empresa antes de enviar mensagens',
    })
  }
  const message = await createMessage({
    leadId: lead.id,
    direction: 'outbound',
    senderType: 'human',
    content,
  })
  await updateLastMessage(lead.id, content)
  try {
    const sent = await sendWhatsappMessage(lead.phone, content, whatsappFrom)
    await updateMessageTwilioSid(message.id, sent.sid)
    message.twilioMessageSid = sent.sid
    return res.json({ message, deliveryStatus: 'sent' })
  } catch (error) {
    console.error('Manual WhatsApp delivery failed', error)
    return res.status(202).json({
      message,
      deliveryStatus: 'failed',
      deliveryError: error instanceof Error ? error.message : 'Falha no envio',
    })
  }
})

leadsRouter.post('/webhooks/twilio/whatsapp', async (req: Request, res: Response) => {
  const url = `${leadConfig.publicBackendUrl}${req.originalUrl}`
  if (!validateTwilioRequest(req.header('x-twilio-signature') ?? '', url, req.body)) {
    return res.status(403).json({ error: 'Assinatura Twilio inválida' })
  }
  const from = normalizeText(req.body.From)
  const to = normalizeText(req.body.To)
  const body = normalizeText(req.body.Body)
  const messageSid = normalizeText(req.body.MessageSid) || null
  let audio = null
  try {
    audio = parseInboundAudio(req.body)
  } catch (error) {
    console.error('Invalid Twilio audio payload', error)
    return res.type('text/xml').send(emptyTwiml())
  }
  if (!from || (!body && !audio)) return res.type('text/xml').send(emptyTwiml())

  const companyId = await resolveWebhookCompanyId(to)
  if (!companyId) {
    console.error('Twilio webhook company could not be resolved', { to })
    return res.status(503).type('text/xml').send(emptyTwiml())
  }

  const lead = await findOrCreateLeadByPhone(companyId, normalizeWhatsappPhone(from))
  const isAudio = Boolean(audio && leadConfig.audioEnabled)
  const receipt = await createInboundMessageIdempotently({
    leadId: lead.id,
    direction: 'inbound',
    senderType: 'lead',
    content: audio ? (isAudio ? body || audioPendingContent : audioFailedContent) : body,
    twilioMessageSid: messageSid,
    messageType: audio ? 'audio' : 'text',
    processingStatus: isAudio ? 'pending' : audio ? 'failed' : 'ready',
    sourceContentType: audio?.contentType ?? null,
  })
  if (receipt.created) {
    await updateLastMessage(lead.id, isAudio ? '🎤 Áudio' : receipt.message.content)
    if (isAudio && audio) {
      await createAudioJob({
        messageId: receipt.message.id,
        mediaSid: audio.mediaSid,
        contentType: audio.contentType,
        whatsappFrom: to || null,
      })
    }
  }
  res.type('text/xml').send(emptyTwiml())
  if (receipt.created && receipt.message.processingStatus === 'ready') {
    void processInboundMessage(receipt.message.id, to || undefined).catch((error) =>
      console.error('Inbound conversation failed', error),
    )
  }
})
