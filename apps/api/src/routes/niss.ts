import { Router } from 'express'
import { AppDataSource } from '../data-source'
import { requireResourceUser } from '../auth/current-user'
import { requireAuth } from '../auth/middleware'
import { Client } from '../entities/Client'
import {
  createNissProcess,
  downloadNissDocument,
  getNissDocuments,
  getNissDossier,
  getNissProcess,
  listNissProcesses,
} from '../niss-client'
import { createZip } from '../zip'

export const nissRouter = Router()
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/
const PROCESS_ID = /^\d+$/

async function authorizedProcess(id: string, companyId: number) {
  if (!PROCESS_ID.test(id)) return null
  const process = await getNissProcess(id)
  if (!UUID.test(process.clientId)) return null
  const client = await AppDataSource.getRepository(Client).findOneBy({
    id: process.clientId,
    companyId,
  })
  return client ? { process, client } : null
}

nissRouter.get('/niss', requireAuth, async (req, res) => {
  const user = await requireResourceUser(req, res, 'niss')
  if (!user) return
  try {
    const clients = await AppDataSource.getRepository(Client).find({
      where: { companyId: user.companyId },
      order: { name: 'ASC' },
    })
    const byId = new Map(clients.map((client) => [client.id, client]))
    const processes = (await listNissProcesses())
      .filter((process) => byId.has(process.clientId))
      .map((process) => ({ ...process, client: byId.get(process.clientId) }))
    res.json(processes)
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'Falha ao consultar o BotNiss.' })
  }
})

nissRouter.post('/niss', requireAuth, async (req, res) => {
  const user = await requireResourceUser(req, res, 'niss')
  if (!user) return
  const clientId = typeof req.body.clientId === 'string' ? req.body.clientId : ''
  const requestNumber = typeof req.body.requestNumber === 'string' ? req.body.requestNumber.trim() : ''
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const birthDate = typeof req.body.birthDate === 'string' ? req.body.birthDate : ''
  if (!UUID.test(clientId)) return void res.status(400).json({ error: 'Selecione um cliente.' })
  if (!/^\d+$/.test(requestNumber)) return void res.status(400).json({ error: 'O número do pedido NISS deve conter somente dígitos.' })
  if (!/^\S+@\S+\.\S+$/.test(email)) return void res.status(400).json({ error: 'Informe um email válido.' })
  if (!DATE.test(birthDate) || Number.isNaN(Date.parse(`${birthDate}T00:00:00Z`))) {
    return void res.status(400).json({ error: 'Informe uma data de nascimento válida.' })
  }
  const client = await AppDataSource.getRepository(Client).findOneBy({ id: clientId, companyId: user.companyId })
  if (!client) return void res.status(404).json({ error: 'Cliente não encontrado na empresa atual.' })
  try {
    const process = await createNissProcess({ companyId: user.companyId, clientId, requestNumber, email, birthDate })
    res.status(201).json({ ...process, client })
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'Falha ao criar solicitação no BotNiss.' })
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
    res.status(502).json({ error: error instanceof Error ? error.message : 'Falha ao consultar o dossiê.' })
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
    res.status(502).json({ error: error instanceof Error ? error.message : 'Falha ao consultar os documentos.' })
  }
})

nissRouter.get('/niss/:id/documents/:docIndex', requireAuth, async (req, res) => {
  const user = await requireResourceUser(req, res, 'niss')
  if (!user) return
  try {
    const authorized = await authorizedProcess(req.params.id, user.companyId)
    if (!authorized) return void res.status(404).json({ error: 'Pedido NISS não encontrado.' })
    const docIndex = parseInt(req.params.docIndex, 10)
    if (isNaN(docIndex) || docIndex < 0) return void res.status(400).json({ error: 'Índice do documento inválido.' })
    const documents = await getNissDocuments(req.params.id)
    const document = documents[docIndex]
    if (!document || !document.accessUrl) return void res.status(404).json({ error: 'Documento não encontrado.' })
    const data = await downloadNissDocument(document.accessUrl)
    const sanitizedFileName = document.fileName.replace(/[^a-zA-Z0-9._ -]/g, '_')
    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFileName}"`)
    res.setHeader('Cache-Control', 'no-store')
    res.send(data)
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'Falha ao transferir o documento.' })
  }
})

nissRouter.get('/niss/:id/documents.zip', requireAuth, async (req, res) => {
  const user = await requireResourceUser(req, res, 'niss')
  if (!user) return
  try {
    const authorized = await authorizedProcess(req.params.id, user.companyId)
    if (!authorized) return void res.status(404).json({ error: 'Pedido NISS não encontrado.' })
    const documents = (await getNissDocuments(req.params.id)).filter((document) => document.accessUrl)
    if (!documents.length) return void res.status(404).json({ error: 'Este pedido ainda não possui documentos disponíveis.' })
    const entries = await Promise.all(documents.map(async (document, index) => ({
      name: `${String(index + 1).padStart(2, '0')}-${document.fileName.replace(/[^a-zA-Z0-9._ -]/g, '_')}`,
      data: await downloadNissDocument(document.accessUrl!),
    })))
    const archive = createZip(entries)
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="pedido-niss-${req.params.id}.zip"`)
    res.setHeader('Cache-Control', 'no-store')
    res.send(archive)
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'Falha ao gerar o arquivo ZIP.' })
  }
})
