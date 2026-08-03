import { Router } from 'express'
import { AppDataSource } from '../data-source'
import { requireResourceUser } from '../auth/current-user'
import { requireAuth } from '../auth/middleware'
import { Client } from '../entities/Client'
import {
  createAimaProcess,
  downloadAimaDocument,
  getAimaDocuments,
  getAimaDossier,
  getAimaProcess,
  listAimaProcesses,
  reprocessAimaProcess,
} from '../aima-client'

export const aimaRouter = Router()
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TRACKING_URL = /^https:\/\/contactenos\.aima\.gov\.pt\/tracking\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i
const PROCESS_ID = /^\d+$/

async function authorizedProcess(id: string, companyId: number) {
  if (!PROCESS_ID.test(id)) return null
  const process = await getAimaProcess(id)
  if (!UUID.test(process.clientId)) return null
  const client = await AppDataSource.getRepository(Client).findOneBy({
    id: process.clientId,
    companyId,
  })
  return client ? { process, client } : null
}

aimaRouter.get('/aima', requireAuth, async (req, res) => {
  const user = await requireResourceUser(req, res, 'aima')
  if (!user) return
  try {
    const clients = await AppDataSource.getRepository(Client).find({
      where: { companyId: user.companyId },
      order: { name: 'ASC' },
    })
    const byId = new Map(clients.map((client) => [client.id, client]))
    const processes = (await listAimaProcesses())
      .filter((process) => byId.has(process.clientId))
      .map((process) => ({ ...process, client: byId.get(process.clientId) }))
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
  try {
    const process = await createAimaProcess({
      companyId: user.companyId,
      clientId,
      trackingUrl: `https://contactenos.aima.gov.pt/tracking/${trackingUrl.split('/').pop()!.toLowerCase()}`,
    })
    res.status(201).json({ ...process, client })
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : 'Falha ao criar acompanhamento no BotAIMA.',
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
    res.json(await reprocessAimaProcess(req.params.id))
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : 'Falha ao solicitar o reprocessamento AIMA.',
    })
  }
})
