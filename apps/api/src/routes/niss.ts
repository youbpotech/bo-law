import { Router } from 'express'
import { AppDataSource } from '../data-source'
import { requireResourceUser } from '../auth/current-user'
import { requireAuth } from '../auth/middleware'
import { Client } from '../entities/Client'
import { ServiceType } from '../entities/ServiceType'
import { LegalCaseIntegration } from '../entities/LegalCaseIntegration'
import {
  createNissProcess,
  downloadNissDocument,
  getNissDocuments,
  getNissDossier,
  getNissProcess,
  listNissProcesses,
  reprocessNissProcess,
  type NissProcess,
} from '../niss-client'
import { createZip } from '../zip'
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

export const nissRouter = Router()
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/
const PROCESS_ID = /^\d+$/

function clientName(client: Client): string {
  return [client.name, client.surname].filter(Boolean).join(' ')
}

function publicNissProcess(process: NissProcess): Omit<NissProcess, 'sourceReference'> {
  const result: Partial<NissProcess> = { ...process }
  delete result.sourceReference
  return result as Omit<NissProcess, 'sourceReference'>
}

function nissSnapshot(
  companyId: number,
  client: Client,
  process: NissProcess,
): RemoteIntegratedLegalCaseSnapshot {
  const status = process.operationalStatusName.toUpperCase()
  return {
    companyId,
    clientId: client.id,
    caseType: 'niss',
    title: `NISS — ${clientName(client)}`,
    serviceType: 'Atribuição de NISS',
    provider: 'botniss',
    externalProcessId: process.id,
    externalReference: process.requestNumber,
    operationalStatus: process.operationalStatus,
    operationalStatusName: status,
    remoteCreatedAt: process.createdAt,
    remoteUpdatedAt: process.updatedAt,
    terminal: status === 'CONCLUIDO',
    actionRequired: status === 'NEGADO',
    metadata: {
      requestNumber: process.requestNumber,
      portalStatus: process.portalStatus,
      denialReason: process.denialReason,
      nissCommunicated: process.nissCommunicated,
    },
  }
}

async function ensureNissLegalCase(
  companyId: number,
  client: Client,
  process: NissProcess,
  integration: LegalCaseIntegration,
) {
  if (process.sourceReference !== integration.legalCaseId) {
    throw new Error('A referência do BotNiss não corresponde ao processo jurídico associado.')
  }
  const snapshot = nissSnapshot(companyId, client, process)
  const transition = await syncIntegratedLegalCaseSnapshot(integration, snapshot)
  if (transition.eventType) {
    const actionRequired = transition.eventType === 'process.action_required'
    const completed = transition.eventType === 'process.completed'
    await notifyLegalCaseEvent({
      legalCaseId: integration.legalCaseId,
      eventType: transition.eventType,
      title: actionRequired
        ? 'Processo NISS requer atenção'
        : completed
          ? 'Processo NISS concluído'
          : 'Estado do processo NISS atualizado',
      body: actionRequired
        ? `O pedido NISS ${process.requestNumber} foi negado e requer análise.`
        : `O pedido NISS ${process.requestNumber} passou para ${process.operationalStatusName}.`,
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
  const integration = await findCompanyCaseIntegrationByExternalId(companyId, 'botniss', id)
  if (integration) {
    const process = await getNissProcess(id)
    await ensureNissLegalCase(companyId, integration.legalCase.client, process, integration)
    return {
      process,
      integration,
      client: integration.legalCase.client,
      legalCaseId: integration.legalCaseId,
    }
  }
  return null
}

nissRouter.get('/niss', requireAuth, async (req, res) => {
  const user = await requireResourceUser(req, res, 'niss')
  if (!user) return
  try {
    const integrations = await listCompanyCaseIntegrations(user.companyId, 'botniss')
    const byExternalId = new Map(
      integrations
        .filter(({ externalProcessId }) => externalProcessId)
        .map((integration) => [integration.externalProcessId!, integration]),
    )
    const processes = (
      await Promise.all(
        (await listNissProcesses()).map(async (process) => {
          const integration = byExternalId.get(process.id)
          if (!integration) return null
          const client = integration.legalCase.client
          await ensureNissLegalCase(user.companyId, client, process, integration)
          return {
            ...publicNissProcess(process),
            clientId: client.id,
            client,
            legalCaseId: integration.legalCaseId,
          }
        }),
      )
    ).filter((process) => process !== null)
    res.json(processes)
  } catch (error) {
    res
      .status(502)
      .json({ error: error instanceof Error ? error.message : 'Falha ao consultar o BotNiss.' })
  }
})

nissRouter.post('/niss', requireAuth, async (req, res) => {
  const user = await requireResourceUser(req, res, 'niss')
  if (!user) return
  const clientId = typeof req.body.clientId === 'string' ? req.body.clientId : ''
  const requestNumber =
    typeof req.body.requestNumber === 'string' ? req.body.requestNumber.trim() : ''
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const birthDate = typeof req.body.birthDate === 'string' ? req.body.birthDate : ''
  let stakeholderUserIds: string[]
  try {
    stakeholderUserIds = parseStakeholderUserIds(req.body.stakeholderUserIds)
  } catch (error) {
    return void res
      .status(400)
      .json({ error: error instanceof Error ? error.message : 'Stakeholders inválidos.' })
  }
  if (!UUID.test(clientId)) return void res.status(400).json({ error: 'Selecione um cliente.' })
  if (!/^\d+$/.test(requestNumber))
    return void res
      .status(400)
      .json({ error: 'O número do pedido NISS deve conter somente dígitos.' })
  if (!/^\S+@\S+\.\S+$/.test(email))
    return void res.status(400).json({ error: 'Informe um email válido.' })
  if (!DATE.test(birthDate) || Number.isNaN(Date.parse(`${birthDate}T00:00:00Z`))) {
    return void res.status(400).json({ error: 'Informe uma data de nascimento válida.' })
  }
  const client = await AppDataSource.getRepository(Client).findOneBy({
    id: clientId,
    companyId: user.companyId,
  })
  if (!client)
    return void res.status(404).json({ error: 'Cliente não encontrado na empresa atual.' })
  let prepared: PreparedIntegratedLegalCase | null = null
  try {
    const service = await AppDataSource.getRepository(ServiceType).findOneBy({ companyId: user.companyId, code: 'niss', active: true })
    if (!service) return void res.status(409).json({ error: 'O serviço NISS não está configurado para esta empresa.' })
    prepared = await prepareIntegratedLegalCase({
      companyId: user.companyId,
      clientId,
      creatorUserId: user.id,
      stakeholderUserIds,
      caseType: 'niss',
      title: `NISS — ${[client.name, client.surname].filter(Boolean).join(' ')}`,
      serviceId: service.id,
      provider: 'botniss',
      externalReference: requestNumber,
      metadata: { requestNumber },
    })
    const process = prepared.alreadyIntegrated
      ? await getNissProcess(prepared.integration.externalProcessId!)
      : await createNissProcess({
          companyId: user.companyId,
          clientId,
          legalCaseId: prepared.legalCase.id,
          requestNumber,
          email,
          birthDate,
        })
    if (process.sourceReference !== prepared.legalCase.id) {
      throw new Error('A referência devolvida pelo BotNiss não corresponde ao processo jurídico.')
    }
    if (!prepared.alreadyIntegrated) {
      const activated = await activateLegalCaseIntegration(
        prepared.legalCase.id,
        prepared.integration.id,
        process.id,
        prepared.processingToken!,
      )
      if (!activated) throw new Error('A reserva da integração NISS expirou antes da conclusão.')
    }
    await notifyLegalCaseEvent({
      legalCaseId: prepared.legalCase.id,
      eventType: 'process.created',
      title: 'Novo processo NISS criado',
      body: `O acompanhamento do pedido NISS ${requestNumber} foi criado.`,
      actorUserId: user.id,
    }).catch((error) => console.error('Falha ao notificar a criação do processo NISS', error))
    res.status(prepared.alreadyIntegrated ? 200 : 201).json({
      ...publicNissProcess(process),
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
          title: 'Falha ao integrar processo NISS',
          body: 'O processo foi registado, mas a integração com o BotNiss falhou e pode ser repetida.',
          actorUserId: user.id,
        }).catch(() => undefined)
      }
    }
    res.status(502).json({
      error: error instanceof Error ? error.message : 'Falha ao criar solicitação no BotNiss.',
      ...(prepared ? { legalCaseId: prepared.legalCase.id } : {}),
    })
  }
})

nissRouter.get('/niss/:id/dossier', requireAuth, async (req, res) => {
  const user = await requireResourceUser(req, res, 'niss')
  if (!user) return
  try {
    const authorized = await authorizedProcess(req.params.id, user.companyId)
    if (!authorized) return void res.status(404).json({ error: 'Pedido NISS não encontrado.' })
    res.json(await getNissDossier(req.params.id))
  } catch (error) {
    res
      .status(502)
      .json({ error: error instanceof Error ? error.message : 'Falha ao consultar o dossiê.' })
  }
})

nissRouter.get('/niss/:id/documents', requireAuth, async (req, res) => {
  const user = await requireResourceUser(req, res, 'niss')
  if (!user) return
  try {
    const authorized = await authorizedProcess(req.params.id, user.companyId)
    if (!authorized) return void res.status(404).json({ error: 'Pedido NISS não encontrado.' })
    const documents = await getNissDocuments(req.params.id)
    res.json(documents.map(({ id, fileName, mimeType }) => ({ id, fileName, mimeType })))
  } catch (error) {
    res
      .status(502)
      .json({ error: error instanceof Error ? error.message : 'Falha ao consultar os documentos.' })
  }
})

nissRouter.get('/niss/:id/documents/:fileName', requireAuth, async (req, res) => {
  const user = await requireResourceUser(req, res, 'niss')
  if (!user) return
  try {
    const authorized = await authorizedProcess(req.params.id, user.companyId)
    if (!authorized) return void res.status(404).json({ error: 'Pedido NISS não encontrado.' })
    const documents = await getNissDocuments(req.params.id)
    const document = documents.find(({ fileName }) => fileName === req.params.fileName)
    if (!document) return void res.status(404).json({ error: 'Documento não encontrado.' })
    const download = await downloadNissDocument(req.params.id, document.fileName)
    const sanitizedFileName = download.fileName
      .replace(/^.*[\\/]/, '')
      .replace(/[^a-zA-Z0-9._ -]/g, '_')
    res.setHeader('Content-Type', download.mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFileName}"`)
    res.setHeader('Cache-Control', 'no-store')
    res.send(download.data)
  } catch (error) {
    res
      .status(502)
      .json({ error: error instanceof Error ? error.message : 'Falha ao transferir o documento.' })
  }
})

nissRouter.get('/niss/:id/documents.zip', requireAuth, async (req, res) => {
  const user = await requireResourceUser(req, res, 'niss')
  if (!user) return
  try {
    const authorized = await authorizedProcess(req.params.id, user.companyId)
    if (!authorized) return void res.status(404).json({ error: 'Pedido NISS não encontrado.' })
    const documents = await getNissDocuments(req.params.id)
    if (!documents.length)
      return void res
        .status(404)
        .json({ error: 'Este pedido ainda não possui documentos disponíveis.' })
    const entries = await Promise.all(
      documents.map(async (document, index) => {
        const download = await downloadNissDocument(req.params.id, document.fileName)
        const sanitizedFileName = download.fileName
          .replace(/^.*[\\/]/, '')
          .replace(/[^a-zA-Z0-9._ -]/g, '_')
        return {
          name: `${String(index + 1).padStart(2, '0')}-${sanitizedFileName}`,
          data: download.data,
        }
      }),
    )
    const archive = createZip(entries)
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="pedido-niss-${req.params.id}.zip"`)
    res.setHeader('Cache-Control', 'no-store')
    res.send(archive)
  } catch (error) {
    res
      .status(502)
      .json({ error: error instanceof Error ? error.message : 'Falha ao gerar o arquivo ZIP.' })
  }
})

nissRouter.post('/niss/:id/reprocess', requireAuth, async (req, res) => {
  const user = await requireResourceUser(req, res, 'niss')
  if (!user) return
  try {
    const authorized = await authorizedProcess(req.params.id, user.companyId)
    if (!authorized) return void res.status(404).json({ error: 'Pedido NISS não encontrado.' })
    const process = await reprocessNissProcess(req.params.id)
    await ensureNissLegalCase(
      user.companyId,
      authorized.client,
      process,
      authorized.integration,
    )
    res.json({
      ...publicNissProcess(process),
      clientId: authorized.client.id,
      client: authorized.client,
      legalCaseId: authorized.legalCaseId,
    })
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : 'Falha ao solicitar a reconsulta NISS.',
    })
  }
})
