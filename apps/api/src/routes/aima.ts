import { Router } from 'express'
import { AppDataSource } from '../data-source'
import { requireResourceUser } from '../auth/current-user'
import { requireAuth } from '../auth/middleware'
import { Client } from '../entities/Client'
import { ServiceType } from '../entities/ServiceType'
import { LegalCaseIntegration } from '../entities/LegalCaseIntegration'
import {
  createAimaProcess,
  downloadAimaDocument,
  getAimaDocuments,
  getAimaDossier,
  getAimaProcess,
  listAimaProcesses,
  reprocessAimaProcess,
  type AimaProcess,
} from '../aima-client'
import {
  activateLegalCaseIntegration,
  failLegalCaseIntegration,
  findCompanyCaseIntegrationByExternalId,
  listCompanyCaseIntegrations,
  IntegrationAlreadyProcessingError,
  LegalCaseParticipantValidationError,
  parseStakeholderUserIds,
  prepareIntegratedLegalCase,
  syncIntegratedLegalCaseSnapshot,
  type RemoteIntegratedLegalCaseSnapshot,
  type PreparedIntegratedLegalCase,
} from '../cases/process-service'
import { notifyLegalCaseEvent } from '../notifications/case-events'

export const aimaRouter = Router()
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TRACKING_URL = /^https:\/\/contactenos\.aima\.gov\.pt\/tracking\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i
const PROCESS_ID = /^\d+$/

function clientName(client: Client): string {
  return [client.name, client.surname].filter(Boolean).join(' ')
}

function publicAimaProcess(process: AimaProcess): Omit<AimaProcess, 'sourceReference'> {
  const result: Partial<AimaProcess> = { ...process }
  delete result.sourceReference
  return result as Omit<AimaProcess, 'sourceReference'>
}

function aimaSnapshot(
  companyId: number,
  client: Client,
  process: AimaProcess,
): RemoteIntegratedLegalCaseSnapshot {
  return {
    companyId,
    clientId: client.id,
    caseType: 'aima',
    title: `AIMA — ${clientName(client)}`,
    serviceType: 'Acompanhamento de processo AIMA',
    provider: 'botaima',
    externalProcessId: process.id,
    externalReference: process.trackingUrl,
    operationalStatus: process.operationalStatus,
    operationalStatusName: process.operationalStatusName,
    remoteCreatedAt: process.createdAt,
    remoteUpdatedAt: process.updatedAt,
    terminal: process.operationalStatusName === 'CONCLUIDA',
    actionRequired: process.operationalStatusName === 'BLOQUEADA',
    metadata: {
      trackingUrl: process.trackingUrl,
      processNumber: process.processNumber,
      titleNumber: process.titleNumber,
      currentState: process.currentState,
      currentGuidance: process.currentGuidance,
      denialReason: process.denialReason,
    },
  }
}

async function ensureAimaLegalCase(
  companyId: number,
  client: Client,
  process: AimaProcess,
  integration: LegalCaseIntegration,
) {
  if (process.sourceReference !== integration.legalCaseId) {
    throw new Error('A referência do BotAIMA não corresponde ao processo jurídico associado.')
  }
  const snapshot = aimaSnapshot(companyId, client, process)
  const transition = await syncIntegratedLegalCaseSnapshot(integration, snapshot)
  if (transition.eventType) {
    const actionRequired = transition.eventType === 'process.action_required'
    const completed = transition.eventType === 'process.completed'
    await notifyLegalCaseEvent({
      legalCaseId: integration.legalCaseId,
      eventType: transition.eventType,
      title: actionRequired
        ? 'Processo AIMA requer atenção'
        : completed
          ? 'Processo AIMA concluído'
          : 'Estado do processo AIMA atualizado',
      body: actionRequired
        ? 'O processo AIMA está bloqueado e requer análise.'
        : `O processo AIMA passou para ${process.operationalStatusName}.`,
      eventKey: transition.eventKey,
      metadata: {
        externalProcessId: process.id,
        operationalStatus: process.operationalStatusName,
      },
    })
  }
  return integration
}

async function authorizedProcess(id: string, companyId: number) {
  if (!PROCESS_ID.test(id)) return null
  const integration = await findCompanyCaseIntegrationByExternalId(companyId, 'botaima', id)
  if (integration) {
    const process = await getAimaProcess(id)
    await ensureAimaLegalCase(companyId, integration.legalCase.client, process, integration)
    return {
      process,
      integration,
      client: integration.legalCase.client,
      legalCaseId: integration.legalCaseId,
    }
  }
  return null
}

aimaRouter.get('/aima', requireAuth, async (req, res) => {
  const user = await requireResourceUser(req, res, 'aima')
  if (!user) return
  try {
    const integrations = await listCompanyCaseIntegrations(user.companyId, 'botaima')
    const byExternalId = new Map(
      integrations
        .filter(({ externalProcessId }) => externalProcessId)
        .map((integration) => [integration.externalProcessId!, integration]),
    )
    const processes = (
      await Promise.all(
        (await listAimaProcesses()).map(async (process) => {
          const integration = byExternalId.get(process.id)
          if (!integration) return null
          const client = integration.legalCase.client
          await ensureAimaLegalCase(user.companyId, client, process, integration)
          return {
            ...publicAimaProcess(process),
            clientId: client.id,
            client,
            legalCaseId: integration.legalCaseId,
          }
        }),
      )
    ).filter((process) => process !== null)
    res.json(processes)
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : 'Falha ao consultar o BotAIMA.',
    })
  }
})

aimaRouter.post('/aima', requireAuth, async (req, res) => {
  const user = await requireResourceUser(req, res, 'aima')
  if (!user) return
  const clientId = typeof req.body.clientId === 'string' ? req.body.clientId : ''
  const trackingUrl = typeof req.body.trackingUrl === 'string' ? req.body.trackingUrl.trim() : ''
  let stakeholderUserIds: string[]
  try {
    stakeholderUserIds = parseStakeholderUserIds(req.body.stakeholderUserIds)
  } catch (error) {
    return void res
      .status(400)
      .json({ error: error instanceof Error ? error.message : 'Stakeholders inválidos.' })
  }
  if (!UUID.test(clientId)) return void res.status(400).json({ error: 'Selecione um cliente.' })
  if (!TRACKING_URL.test(trackingUrl)) {
    return void res.status(400).json({
      error: 'Informe o link AIMA no formato https://contactenos.aima.gov.pt/tracking/<UUID>.',
    })
  }
  const client = await AppDataSource.getRepository(Client).findOneBy({
    id: clientId,
    companyId: user.companyId,
  })
  if (!client) return void res.status(404).json({ error: 'Cliente não encontrado na empresa atual.' })
  const normalizedTrackingUrl = `https://contactenos.aima.gov.pt/tracking/${trackingUrl.split('/').pop()!.toLowerCase()}`
  let prepared: PreparedIntegratedLegalCase | null = null
  try {
    const service = await AppDataSource.getRepository(ServiceType).findOneBy({ companyId: user.companyId, code: 'aima', active: true })
    if (!service) return void res.status(409).json({ error: 'O serviço AIMA não está configurado para esta empresa.' })
    prepared = await prepareIntegratedLegalCase({
      companyId: user.companyId,
      clientId,
      creatorUserId: user.id,
      stakeholderUserIds,
      caseType: 'aima',
      title: `AIMA — ${[client.name, client.surname].filter(Boolean).join(' ')}`,
      serviceId: service.id,
      provider: 'botaima',
      externalReference: normalizedTrackingUrl,
      metadata: { trackingUrl: normalizedTrackingUrl },
    })
    const process = prepared.alreadyIntegrated
      ? await getAimaProcess(prepared.integration.externalProcessId!)
      : await createAimaProcess({
          companyId: user.companyId,
          clientId,
          legalCaseId: prepared.legalCase.id,
          trackingUrl: normalizedTrackingUrl,
        })
    if (process.sourceReference !== prepared.legalCase.id) {
      throw new Error('A referência devolvida pelo BotAIMA não corresponde ao processo jurídico.')
    }
    if (!prepared.alreadyIntegrated) {
      const activated = await activateLegalCaseIntegration(
        prepared.legalCase.id,
        prepared.integration.id,
        process.id,
        prepared.processingToken!,
      )
      if (!activated) throw new Error('A reserva da integração AIMA expirou antes da conclusão.')
    }
    await notifyLegalCaseEvent({
      legalCaseId: prepared.legalCase.id,
      eventType: 'process.created',
      title: 'Novo processo AIMA criado',
      body: 'O acompanhamento do processo AIMA foi criado.',
      actorUserId: user.id,
    }).catch((error) => console.error('Falha ao notificar a criação do processo AIMA', error))
    res.status(prepared.alreadyIntegrated ? 200 : 201).json({
      ...publicAimaProcess(process),
      clientId: client.id,
      client,
      legalCaseId: prepared.legalCase.id,
    })
  } catch (error) {
    if (error instanceof IntegrationAlreadyProcessingError) {
      res.status(409).json({ error: error.message })
      return
    }
    if (error instanceof LegalCaseParticipantValidationError) {
      res.status(400).json({ error: error.message })
      return
    }
    if (prepared?.processingToken && !prepared.alreadyIntegrated) {
      const markedFailed = await failLegalCaseIntegration(
        prepared.legalCase.id,
        prepared.integration.id,
        prepared.processingToken,
        error,
      ).catch(() => false)
      if (markedFailed) {
        await notifyLegalCaseEvent({
          legalCaseId: prepared.legalCase.id,
          eventType: 'process.failed',
          title: 'Falha ao integrar processo AIMA',
          body: 'O processo foi registado, mas a integração com o BotAIMA falhou e pode ser repetida.',
          actorUserId: user.id,
        }).catch(() => undefined)
      }
    }
    res.status(502).json({
      error: error instanceof Error ? error.message : 'Falha ao criar acompanhamento no BotAIMA.',
      ...(prepared ? { legalCaseId: prepared.legalCase.id } : {}),
    })
  }
})

aimaRouter.get('/aima/:id/dossier', requireAuth, async (req, res) => {
  const user = await requireResourceUser(req, res, 'aima')
  if (!user) return
  try {
    const authorized = await authorizedProcess(req.params.id, user.companyId)
    if (!authorized) return void res.status(404).json({ error: 'Processo AIMA não encontrado.' })
    res.json(await getAimaDossier(req.params.id))
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : 'Falha ao consultar o dossiê AIMA.',
    })
  }
})

aimaRouter.get('/aima/:id/documents', requireAuth, async (req, res) => {
  const user = await requireResourceUser(req, res, 'aima')
  if (!user) return
  try {
    const authorized = await authorizedProcess(req.params.id, user.companyId)
    if (!authorized) return void res.status(404).json({ error: 'Processo AIMA não encontrado.' })
    res.json(await getAimaDocuments(req.params.id))
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : 'Falha ao consultar os documentos AIMA.',
    })
  }
})

aimaRouter.get('/aima/:id/documents/:fileName', requireAuth, async (req, res) => {
  const user = await requireResourceUser(req, res, 'aima')
  if (!user) return
  try {
    const authorized = await authorizedProcess(req.params.id, user.companyId)
    if (!authorized) return void res.status(404).json({ error: 'Processo AIMA não encontrado.' })
    const documents = await getAimaDocuments(req.params.id)
    const document = documents.find(({ fileName }) => fileName === req.params.fileName)
    if (!document) return void res.status(404).json({ error: 'Documento não encontrado.' })
    const download = await downloadAimaDocument(req.params.id, document.fileName)
    const sanitizedFileName = download.fileName
      .replace(/^.*[\\/]/, '')
      .replace(/[^a-zA-Z0-9._ -]/g, '_')
    res.setHeader('Content-Type', download.mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFileName}"`)
    res.setHeader('Cache-Control', 'no-store')
    res.send(download.data)
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : 'Falha ao transferir o documento AIMA.',
    })
  }
})

aimaRouter.post('/aima/:id/reprocess', requireAuth, async (req, res) => {
  const user = await requireResourceUser(req, res, 'aima')
  if (!user) return
  try {
    const authorized = await authorizedProcess(req.params.id, user.companyId)
    if (!authorized) return void res.status(404).json({ error: 'Processo AIMA não encontrado.' })
    const process = await reprocessAimaProcess(req.params.id)
    await ensureAimaLegalCase(
      user.companyId,
      authorized.client,
      process,
      authorized.integration,
    )
    res.json({
      ...publicAimaProcess(process),
      clientId: authorized.client.id,
      client: authorized.client,
      legalCaseId: authorized.legalCaseId,
    })
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : 'Falha ao solicitar o reprocessamento AIMA.',
    })
  }
})
