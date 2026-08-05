import { Router } from 'express'
import { AppDataSource } from '../data-source'
import { requireResourceUser, requireRoleRootUser } from '../auth/current-user'
import { requireAuth } from '../auth/middleware'
import { SERVICE_PROCESS_TYPES, ServiceType } from '../entities/ServiceType'

export const servicesRouter = Router()
const codeFor = (name: string) => name.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 70)
const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''

servicesRouter.get('/services', requireAuth, async (req, res) => {
  const user = await requireResourceUser(req, res, 'services'); if (!user) return
  res.json(await AppDataSource.getRepository(ServiceType).find({ where: { companyId: user.companyId }, order: { name: 'ASC' } }))
})

servicesRouter.post('/services', requireAuth, async (req, res) => {
  const user = await requireRoleRootUser(req, res); if (!user) return
  const name = text(req.body.name); const processType = text(req.body.processType) || 'general'
  if (!name || !SERVICE_PROCESS_TYPES.includes(processType as (typeof SERVICE_PROCESS_TYPES)[number])) { res.status(400).json({ error: 'Nome e tipo de processo válidos são obrigatórios.' }); return }
  const repository = AppDataSource.getRepository(ServiceType)
  const base = codeFor(name); let code = base || 'servico'; let index = 2
  while (await repository.exist({ where: { companyId: user.companyId, code } })) code = `${base}-${index++}`
  const service = await repository.save(repository.create({ companyId: user.companyId, code, name, processType: processType as ServiceType['processType'], description: text(req.body.description) || null, active: req.body.active !== false }))
  res.status(201).json(service)
})

servicesRouter.patch('/services/:id', requireAuth, async (req, res) => {
  const user = await requireRoleRootUser(req, res); if (!user) return
  const service = await AppDataSource.getRepository(ServiceType).findOneBy({ id: req.params.id, companyId: user.companyId })
  if (!service) { res.status(404).json({ error: 'Serviço não encontrado.' }); return }
  if (req.body.name !== undefined) { const name = text(req.body.name); if (!name) { res.status(400).json({ error: 'O nome não pode ficar vazio.' }); return }; service.name = name }
  if (req.body.description !== undefined) service.description = text(req.body.description) || null
  if (typeof req.body.active === 'boolean') service.active = req.body.active
  res.json(await AppDataSource.getRepository(ServiceType).save(service))
})
