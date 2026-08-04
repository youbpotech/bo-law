import { Router } from 'express'
import { EntityManager } from 'typeorm'
import { AppDataSource } from '../data-source'
import { requireCurrentUser, requireResourceUser } from '../auth/current-user'
import { requireAuth } from '../auth/middleware'
import { Client } from '../entities/Client'
import { Invoice, InvoiceStatus } from '../entities/Invoice'
import { Lead } from '../entities/Lead'
import { LegalCase, LegalCaseStage } from '../entities/LegalCase'
import { LegalCaseStakeholder } from '../entities/LegalCaseStakeholder'
import { User } from '../entities/User'
import { ServiceType } from '../entities/ServiceType'
import {
  LegalCaseParticipantValidationError,
  loadLegalCaseWithParticipants,
  parseStakeholderUserIds,
  saveLegalCaseStakeholders,
} from '../cases/process-service'
import { notifyLegalCaseEvent } from '../notifications/case-events'
import { downloadAimaDocument, getAimaDocuments } from '../aima-client'
import { downloadNissDocument, getNissDocuments } from '../niss-client'
import {
  CASE_STAGES,
  INVOICE_STATUSES,
  calculateInvoiceAmount,
  canTransitionCaseStage,
  canTransitionInvoiceStatus,
  stageAfterPaidInvoice,
} from '../cases/workflow'

export const casesRouter = Router()

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

casesRouter.get('/process-stakeholders/candidates', requireAuth, async (req, res) => {
  const currentUser = await requireCurrentUser(req, res)
  if (!currentUser) return
  if (
    !currentUser.root &&
    !(['cases', 'niss', 'aima'] as const).some((resource) =>
      currentUser.permissions?.includes(resource),
    )
  ) {
    res.status(403).json({ error: 'Você não possui permissão para criar processos.' })
    return
  }
  const users = await AppDataSource.getRepository(User).find({
    where: { companyId: currentUser.companyId },
    relations: ['notificationChannelPreferences'],
    order: { name: 'ASC' },
  })
  if (!users.some(({ id }) => id === currentUser.id)) {
    res.status(409).json({
      error: 'Use um utilizador associado à empresa atual para criar processos.',
    })
    return
  }
  res.json(
    users.map((user) => {
      const notificationChannels = user.notificationChannelPreferences
        .filter(({ enabled }) => enabled)
        .map(({ channel }) => channel)
      return {
        id: user.id,
        name: user.name,
        notificationChannels: notificationChannels.length ? notificationChannels : ['internal'],
      }
    }),
  )
})

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeNullableText(value: unknown): string | null {
  return normalizeText(value) || null
}

function normalizeMoney(value: unknown): number | null {
  const normalized = typeof value === 'string' ? value.replace(',', '.') : value
  const amount = Number(normalized)
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null
}

function parseOptionalDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

function loadCase(id: string, companyId: number) {
  return loadLegalCaseWithParticipants(id, companyId)
}

type CaseCreationInput = {
  companyId: number
  clientId: string
  leadId?: string | null
  title: string
  serviceId: string
  description?: string | null
  contractedFee: number
  contractSignedAt?: Date | null
  dueAt?: Date | null
  creatorUserId: string
  stakeholderUserIds: string[]
}

async function persistCaseWithPartialInvoice(manager: EntityManager, input: CaseCreationInput) {
  const legalCase = await manager.save(
    manager.create(LegalCase, {
      companyId: input.companyId,
      clientId: input.clientId,
      leadId: input.leadId ?? null,
      createdByUserId: input.creatorUserId,
      caseType: 'general',
      integrationStatus: 'not_applicable',
      title: input.title,
      serviceId: input.serviceId,
      description: input.description ?? null,
      contractedFee: input.contractedFee,
      contractSignedAt: input.contractSignedAt ?? new Date(),
      stage: 'awaiting_initial_payment',
      documentsComplete: false,
      startedAt: null,
      completedAt: null,
    }),
  )

  await saveLegalCaseStakeholders(manager, {
    legalCaseId: legalCase.id,
    companyId: input.companyId,
    creatorUserId: input.creatorUserId,
    stakeholderUserIds: input.stakeholderUserIds,
  })

  await manager.save(
    manager.create(Invoice, {
      legalCaseId: legalCase.id,
      kind: 'partial',
      percentage: 30,
      amount: calculateInvoiceAmount(input.contractedFee, 'partial'),
      status: 'requested',
      dueAt: input.dueAt ?? null,
      issuedAt: null,
      paidAt: null,
    }),
  )

  if (input.leadId) {
    await manager.update(
      Lead,
      { id: input.leadId, companyId: input.companyId },
      {
        clientId: input.clientId,
        salesStage: 'contracted',
        conversationStatus: 'human_active',
        rehydrateAt: null,
      },
    )
  }

  return legalCase.id
}

async function createCaseWithPartialInvoice(input: CaseCreationInput) {
  return AppDataSource.transaction((manager) => persistCaseWithPartialInvoice(manager, input))
}

casesRouter.get('/cases', requireAuth, async (req, res) => {
  const user = await requireResourceUser(req, res, 'cases')
  if (!user) return

  const stage = CASE_STAGES.includes(req.query.stage as LegalCaseStage)
    ? (req.query.stage as LegalCaseStage)
    : undefined
  const repository = AppDataSource.getRepository(LegalCase)
  const query = repository
    .createQueryBuilder('legalCase')
    .leftJoinAndSelect('legalCase.client', 'client')
    .leftJoinAndSelect('legalCase.lead', 'lead')
    .leftJoinAndSelect('legalCase.service', 'service')
    .leftJoinAndSelect('legalCase.invoices', 'invoice')
    .leftJoinAndSelect('legalCase.createdByUser', 'createdByUser')
    .leftJoinAndSelect('legalCase.stakeholders', 'stakeholder')
    .leftJoinAndSelect('stakeholder.user', 'stakeholderUser')
    .leftJoinAndSelect('legalCase.integrations', 'integration')
    .where('legalCase.companyId = :companyId', { companyId: user.companyId })
    .orderBy('legalCase.updatedAt', 'DESC')
    .addOrderBy('invoice.createdAt', 'ASC')

  if (stage) query.andWhere('legalCase.stage = :stage', { stage })

  res.json(await query.getMany())
})

casesRouter.get('/cases/:id', requireAuth, async (req, res) => {
  if (!UUID_PATTERN.test(req.params.id)) {
    res.status(400).json({ error: 'Processo inválido' })
    return
  }
  const user = await requireResourceUser(req, res, 'cases')
  if (!user) return
  const legalCase = await loadCase(req.params.id, user.companyId)
  if (!legalCase) {
    res.status(404).json({ error: 'Processo não encontrado' })
    return
  }
  res.json(legalCase)
})

async function processDocumentIntegration(legalCase: LegalCase) {
  return legalCase.integrations.find(
    (integration) =>
      integration.externalProcessId &&
      (integration.provider === 'botniss' || integration.provider === 'botaima'),
  )
}

casesRouter.get('/cases/:id/documents', requireAuth, async (req, res) => {
  if (!UUID_PATTERN.test(req.params.id)) {
    res.status(400).json({ error: 'Processo inválido' })
    return
  }
  const user = await requireResourceUser(req, res, 'cases')
  if (!user) return
  const legalCase = await loadCase(req.params.id, user.companyId)
  if (!legalCase) {
    res.status(404).json({ error: 'Processo não encontrado' })
    return
  }
  const integration = await processDocumentIntegration(legalCase)
  if (!integration?.externalProcessId) {
    res.json({ provider: null, processId: null, documents: [] })
    return
  }
  try {
    const documents =
      integration.provider === 'botniss'
        ? await getNissDocuments(integration.externalProcessId)
        : await getAimaDocuments(integration.externalProcessId)
    res.json({
      provider: integration.provider,
      processId: integration.externalProcessId,
      documents,
    })
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : 'Não foi possível consultar os documentos.',
    })
  }
})

casesRouter.get('/cases/:id/documents/:fileName', requireAuth, async (req, res) => {
  if (!UUID_PATTERN.test(req.params.id)) {
    res.status(400).json({ error: 'Processo inválido' })
    return
  }
  const user = await requireResourceUser(req, res, 'cases')
  if (!user) return
  const legalCase = await loadCase(req.params.id, user.companyId)
  if (!legalCase) {
    res.status(404).json({ error: 'Processo não encontrado' })
    return
  }
  const integration = await processDocumentIntegration(legalCase)
  if (!integration?.externalProcessId) {
    res.status(404).json({ error: 'Este processo não possui documentos associados.' })
    return
  }
  try {
    const download =
      integration.provider === 'botniss'
        ? await downloadNissDocument(integration.externalProcessId, req.params.fileName)
        : await downloadAimaDocument(integration.externalProcessId, req.params.fileName)
    const fileName = download.fileName.replace(/^.*[\\/]/, '').replace(/[^a-zA-Z0-9._ -]/g, '_')
    res.setHeader('Content-Type', download.mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.setHeader('Cache-Control', 'no-store')
    res.send(download.data)
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : 'Não foi possível transferir o documento.',
    })
  }
})

casesRouter.post('/cases', requireAuth, async (req, res) => {
  const user = await requireResourceUser(req, res, 'cases')
  if (!user) return

  const clientId = normalizeText(req.body.clientId)
  const leadId = normalizeNullableText(req.body.leadId)
  const title = normalizeText(req.body.title)
  const serviceId = normalizeText(req.body.serviceId)
  const contractedFee = normalizeMoney(req.body.contractedFee)
  const contractSignedAt = parseOptionalDate(req.body.contractSignedAt)
  const dueAt = parseOptionalDate(req.body.dueAt)
  let stakeholderUserIds: string[]
  try {
    stakeholderUserIds = parseStakeholderUserIds(req.body.stakeholderUserIds)
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Stakeholders inválidos' })
    return
  }

  if (!UUID_PATTERN.test(clientId) || (leadId && !UUID_PATTERN.test(leadId))) {
    res.status(400).json({ error: 'Cliente ou lead inválido' })
    return
  }
  if (!title || !UUID_PATTERN.test(serviceId) || !contractedFee) {
    res.status(400).json({ error: 'Cliente, título, serviço e honorários são obrigatórios' })
    return
  }
  if ((req.body.contractSignedAt && !contractSignedAt) || (req.body.dueAt && !dueAt)) {
    res.status(400).json({ error: 'Data inválida' })
    return
  }

  const client = await AppDataSource.getRepository(Client).findOneBy({
    id: clientId,
    companyId: user.companyId,
  })
  const lead = leadId
    ? await AppDataSource.getRepository(Lead).findOneBy({ id: leadId, companyId: user.companyId })
    : null
  if (!client || (leadId && !lead)) {
    res.status(404).json({ error: 'Cliente ou lead não encontrado nesta empresa' })
    return
  }
  if (lead && lead.salesStage !== 'interview_completed') {
    res.status(409).json({ error: 'Conclua a entrevista antes de formalizar o contrato' })
    return
  }
  const service = await AppDataSource.getRepository(ServiceType).findOneBy({ id: serviceId, companyId: user.companyId, active: true, processType: 'general' })
  if (!service) { res.status(400).json({ error: 'Selecione um serviço ativo da empresa.' }); return }

  try {
    const id = await createCaseWithPartialInvoice({
      companyId: user.companyId,
      clientId,
      leadId,
      title,
      serviceId: service.id,
      description: normalizeNullableText(req.body.description),
      contractedFee,
      contractSignedAt,
      dueAt,
      creatorUserId: user.id,
      stakeholderUserIds,
    })
    await notifyLegalCaseEvent({
      legalCaseId: id,
      eventType: 'process.created',
      title: 'Novo processo criado',
      body: `O processo "${title}" foi criado.`,
      actorUserId: user.id,
    })
    res.status(201).json(await loadCase(id, user.companyId))
  } catch (error) {
    if (error instanceof LegalCaseParticipantValidationError) {
      res.status(400).json({ error: error.message })
      return
    }
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      res.status(409).json({ error: 'Este lead já possui um processo jurídico' })
      return
    }
    throw error
  }
})

casesRouter.post('/leads/:id/convert', requireAuth, async (req, res) => {
  if (!UUID_PATTERN.test(req.params.id)) {
    res.status(400).json({ error: 'Lead inválido' })
    return
  }
  const user = await requireResourceUser(req, res, 'cases')
  if (!user) return

  const lead = await AppDataSource.getRepository(Lead).findOne({
    where: { id: req.params.id, companyId: user.companyId },
    relations: ['legalCase'],
  })
  if (!lead) {
    res.status(404).json({ error: 'Lead não encontrado' })
    return
  }
  if (lead.legalCase) {
    res.status(409).json({ error: 'Este lead já foi convertido' })
    return
  }
  if (lead.salesStage !== 'interview_completed') {
    res.status(409).json({ error: 'Conclua a entrevista antes de formalizar o contrato' })
    return
  }

  const title = normalizeText(req.body.title)
  const serviceId = normalizeText(req.body.serviceId)
  const contractedFee = normalizeMoney(req.body.contractedFee)
  const requestedClientId = normalizeNullableText(req.body.clientId) || lead.clientId
  const contractSignedAt = parseOptionalDate(req.body.contractSignedAt)
  const dueAt = parseOptionalDate(req.body.dueAt)
  let stakeholderUserIds: string[]
  try {
    stakeholderUserIds = parseStakeholderUserIds(req.body.stakeholderUserIds)
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Stakeholders inválidos' })
    return
  }
  if (!title || !UUID_PATTERN.test(serviceId) || !contractedFee) {
    res.status(400).json({ error: 'Título, serviço e honorários contratados são obrigatórios' })
    return
  }
  if ((req.body.contractSignedAt && !contractSignedAt) || (req.body.dueAt && !dueAt)) {
    res.status(400).json({ error: 'Data inválida' })
    return
  }
  if (requestedClientId && !UUID_PATTERN.test(requestedClientId)) {
    res.status(400).json({ error: 'Cliente inválido' })
    return
  }
  const service = await AppDataSource.getRepository(ServiceType).findOneBy({ id: serviceId, companyId: user.companyId, active: true, processType: 'general' })
  if (!service) { res.status(400).json({ error: 'Selecione um serviço ativo da empresa.' }); return }

  let client: Client | null = null
  let newClient: Pick<Client, 'companyId' | 'name' | 'phone' | 'email'> | null = null
  if (requestedClientId) {
    client = await AppDataSource.getRepository(Client).findOneBy({
      id: requestedClientId,
      companyId: user.companyId,
    })
  } else {
    const name = normalizeText(req.body.clientName) || lead.name || ''
    if (!name) {
      res.status(400).json({ error: 'Informe o nome do cliente para concluir a conversão' })
      return
    }
    newClient = {
      companyId: user.companyId,
      name,
      phone: lead.phone,
      email: lead.email,
    }
  }
  if (!client && !newClient) {
    res.status(404).json({ error: 'Cliente não encontrado nesta empresa' })
    return
  }

  try {
    const id = await AppDataSource.transaction(async (manager) => {
      const persistedClient = client ?? (await manager.save(manager.create(Client, newClient!)))
      return persistCaseWithPartialInvoice(manager, {
        companyId: user.companyId,
        clientId: persistedClient.id,
        leadId: lead.id,
        title,
        serviceId: service.id,
        description: normalizeNullableText(req.body.description) ?? lead.caseSummary,
        contractedFee,
        contractSignedAt,
        dueAt,
        creatorUserId: user.id,
        stakeholderUserIds,
      })
    })
    await notifyLegalCaseEvent({
      legalCaseId: id,
      eventType: 'process.created',
      title: 'Novo processo criado',
      body: `O processo "${title}" foi criado.`,
      actorUserId: user.id,
    })
    res.status(201).json(await loadCase(id, user.companyId))
  } catch (error) {
    if (error instanceof LegalCaseParticipantValidationError) {
      res.status(400).json({ error: error.message })
      return
    }
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      res.status(409).json({ error: 'Este lead já possui um processo jurídico' })
      return
    }
    throw error
  }
})

casesRouter.patch('/cases/:id', requireAuth, async (req, res) => {
  if (!UUID_PATTERN.test(req.params.id)) {
    res.status(400).json({ error: 'Processo inválido' })
    return
  }
  const user = await requireResourceUser(req, res, 'cases')
  if (!user) return
  const repository = AppDataSource.getRepository(LegalCase)
  const legalCase = await repository.findOneBy({ id: req.params.id, companyId: user.companyId })
  if (!legalCase) {
    res.status(404).json({ error: 'Processo não encontrado' })
    return
  }
  const previousStage = legalCase.stage
  let stakeholderUserIds: string[] | undefined
  try {
    stakeholderUserIds =
      req.body.stakeholderUserIds === undefined
        ? undefined
        : parseStakeholderUserIds(req.body.stakeholderUserIds)
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Stakeholders inválidos' })
    return
  }

  if (
    legalCase.caseType !== 'general' &&
    (req.body.stage !== undefined || req.body.documentsComplete !== undefined)
  ) {
    res.status(409).json({
      error: 'A etapa e os documentos deste processo são geridos pela integração externa.',
    })
    return
  }

  if (req.body.title !== undefined) {
    const title = normalizeText(req.body.title)
    if (!title) {
      res.status(400).json({ error: 'O título não pode ficar vazio' })
      return
    }
    legalCase.title = title
  }
  if (req.body.serviceId !== undefined) {
    if (legalCase.caseType !== 'general' || !UUID_PATTERN.test(normalizeText(req.body.serviceId))) { res.status(400).json({ error: 'Serviço inválido para este processo.' }); return }
    const service = await AppDataSource.getRepository(ServiceType).findOneBy({ id: req.body.serviceId, companyId: user.companyId, active: true, processType: 'general' })
    if (!service) { res.status(400).json({ error: 'Selecione um serviço ativo da empresa.' }); return }
    legalCase.serviceId = service.id
  }
  if (req.body.description !== undefined)
    legalCase.description = normalizeNullableText(req.body.description)
  if (
    req.body.documentsComplete === false &&
    ['final_artifacts', 'client_final_delivery', 'awaiting_final_payment', 'closed'].includes(
      legalCase.stage,
    )
  ) {
    res.status(409).json({ error: 'A documentação não pode voltar a incompleta nesta etapa' })
    return
  }
  if (typeof req.body.documentsComplete === 'boolean')
    legalCase.documentsComplete = req.body.documentsComplete

  if (req.body.stage !== undefined) {
    const nextStage = req.body.stage as LegalCaseStage
    if (!CASE_STAGES.includes(nextStage)) {
      res.status(400).json({ error: 'Etapa de processo inválida' })
      return
    }
    if (!canTransitionCaseStage(legalCase.stage, nextStage)) {
      res.status(409).json({ error: 'Transição de etapa não permitida' })
      return
    }
    if (nextStage === 'final_artifacts' && !legalCase.documentsComplete) {
      res.status(409).json({ error: 'Confirme que a documentação está completa antes de avançar' })
      return
    }
    legalCase.stage = nextStage
  }

  try {
    await AppDataSource.transaction(async (manager) => {
      await manager.save(legalCase)
      if (stakeholderUserIds !== undefined) {
        await manager
          .createQueryBuilder()
          .delete()
          .from(LegalCaseStakeholder)
          .where('legal_case_id = :legalCaseId', { legalCaseId: legalCase.id })
          .andWhere('role = :role', { role: 'stakeholder' })
          .execute()
        await saveLegalCaseStakeholders(manager, {
          legalCaseId: legalCase.id,
          companyId: legalCase.companyId,
          creatorUserId: legalCase.createdByUserId,
          stakeholderUserIds,
        })
      }
      if (legalCase.stage === 'awaiting_final_payment') {
        const existing = await manager.findOneBy(Invoice, {
          legalCaseId: legalCase.id,
          kind: 'final',
        })
        if (!existing) {
          await manager.save(
            manager.create(Invoice, {
              legalCaseId: legalCase.id,
              kind: 'final',
              percentage: 70,
              amount: calculateInvoiceAmount(Number(legalCase.contractedFee), 'final'),
              status: 'requested',
              dueAt: null,
              issuedAt: null,
              paidAt: null,
            }),
          )
        }
      }
    })
  } catch (error) {
    if (error instanceof LegalCaseParticipantValidationError) {
      res.status(400).json({ error: error.message })
      return
    }
    throw error
  }
  const updated = await loadCase(legalCase.id, user.companyId)
  if (updated && previousStage !== updated.stage) {
    await notifyLegalCaseEvent({
      legalCaseId: updated.id,
      eventType: updated.stage === 'closed' ? 'process.completed' : 'process.status_changed',
      title: updated.stage === 'closed' ? 'Processo concluído' : 'Etapa do processo atualizada',
      body:
        updated.stage === 'closed'
          ? `O processo "${updated.title}" foi concluído.`
          : `O processo "${updated.title}" avançou para a etapa ${updated.stage}.`,
      actorUserId: user.id,
      eventKey: `${updated.stage}:${updated.updatedAt.toISOString()}`,
    })
  }

  res.json(updated)
})

casesRouter.patch('/cases/:caseId/invoices/:invoiceId', requireAuth, async (req, res) => {
  if (!UUID_PATTERN.test(req.params.caseId) || !UUID_PATTERN.test(req.params.invoiceId)) {
    res.status(400).json({ error: 'Processo ou faturação inválida' })
    return
  }
  const user = await requireResourceUser(req, res, 'cases')
  if (!user) return
  const legalCase = await loadCase(req.params.caseId, user.companyId)
  if (!legalCase) {
    res.status(404).json({ error: 'Processo não encontrado' })
    return
  }
  const invoice = legalCase.invoices.find((item) => item.id === req.params.invoiceId)
  if (!invoice) {
    res.status(404).json({ error: 'Faturação não encontrada' })
    return
  }

  const nextStatus = req.body.status as InvoiceStatus
  if (!INVOICE_STATUSES.includes(nextStatus)) {
    res.status(400).json({ error: 'Estado de faturação inválido' })
    return
  }
  if (!canTransitionInvoiceStatus(invoice.status, nextStatus)) {
    res.status(409).json({ error: 'Transição de faturação não permitida' })
    return
  }
  if (invoice.status === nextStatus) {
    res.json(legalCase)
    return
  }

  const previousCaseStage = legalCase.stage
  invoice.status = nextStatus
  if (nextStatus === 'issued' && !invoice.issuedAt) invoice.issuedAt = new Date()
  if (nextStatus === 'paid' && !invoice.paidAt) invoice.paidAt = new Date()

  await AppDataSource.transaction(async (manager) => {
    await manager.save(invoice)
    if (nextStatus === 'paid') {
      legalCase.stage = stageAfterPaidInvoice(invoice.kind)
      if (invoice.kind === 'partial') legalCase.startedAt ??= new Date()
      if (invoice.kind === 'final') legalCase.completedAt = new Date()
      await manager.save(legalCase)
    }
  })

  const updated = await loadCase(legalCase.id, user.companyId)
  if (updated && previousCaseStage !== updated.stage) {
    await notifyLegalCaseEvent({
      legalCaseId: updated.id,
      eventType: updated.stage === 'closed' ? 'process.completed' : 'process.status_changed',
      title: updated.stage === 'closed' ? 'Processo concluído' : 'Etapa do processo atualizada',
      body:
        updated.stage === 'closed'
          ? `O processo "${updated.title}" foi concluído.`
          : `O processo "${updated.title}" avançou para a etapa ${updated.stage}.`,
      actorUserId: user.id,
      eventKey: `invoice:${invoice.id}:${nextStatus}`,
    })
  }

  res.json(updated)
})
