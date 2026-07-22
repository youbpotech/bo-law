import { Router } from 'express'
import { AppDataSource } from '../data-source'
import {
  getCurrentUser,
  requireCurrentUser,
  requireRootUser,
  serializeCurrentUser,
} from '../auth/current-user'
import { requireAuth } from '../auth/middleware'
import { hashPassword, verifyPassword } from '../auth/password'
import { createAuthToken } from '../auth/token'
import { Client } from '../entities/Client'
import {
  COMPANY_THEMES,
  Company,
  type CompanyTheme,
  DEFAULT_DASHBOARD_WIDGETS,
} from '../entities/Company'
import { User } from '../entities/User'
import { leadsRouter } from '../leads/routes'
import { normalizeWhatsappPhone } from '../leads/twilio-service'
import { casesRouter } from './cases'
import { dashboardRouter, normalizeDashboardConfig } from './dashboard'
import { parseCompanyLogo } from '../company-logo'
import { applyClientProfileInput } from '../client-profile'

const router = Router()
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeNullableText(value: unknown): string | null {
  return normalizeText(value) || null
}

function normalizeWhatsappNumber(value: unknown): string | null {
  const normalized = normalizeWhatsappPhone(normalizeText(value))
  return normalized || null
}

function normalizeTheme(value: unknown): CompanyTheme {
  return typeof value === 'string' && COMPANY_THEMES.includes(value as CompanyTheme)
    ? (value as CompanyTheme)
    : 'default'
}

function isDatabaseError(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}

function serializeCompany(company: Company) {
  return {
    id: company.id,
    name: company.name,
    theme: company.theme,
    hasLogo: Boolean(company.logoMimeType),
    logoUrl: company.logoMimeType
      ? `/api/companies/${company.id}/logo?v=${company.updatedAt.getTime()}`
      : null,
    whatsappNumber: company.whatsappNumber,
    dashboardConfig: normalizeDashboardConfig(company.dashboardConfig),
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
  }
}

function serializeUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    companyId: user.companyId,
    root: user.root,
    company: user.company ? serializeCompany(user.company) : null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'bo-law-api' })
})

router.post('/auth/login', async (req, res) => {
  const username = normalizeText(req.body.username).toLowerCase()
  const password = typeof req.body.password === 'string' ? req.body.password : ''
  if (!username || !password) {
    res.status(400).json({ error: 'Usuário e senha são obrigatórios' })
    return
  }

  const user = await AppDataSource.getRepository(User)
    .createQueryBuilder('user')
    .leftJoinAndSelect('user.company', 'company')
    .addSelect('user.password')
    .where('LOWER(user.username) = LOWER(:username)', { username })
    .getOne()

  if (!user || !(await verifyPassword(password, user.password))) {
    res.status(401).json({ error: 'Usuário ou senha inválidos' })
    return
  }

  res.json({ token: createAuthToken(user), user: serializeUser(user) })
})

router.get('/me', requireAuth, async (req, res) => {
  const user = await getCurrentUser(req)
  if (!user) {
    res.status(401).json({ error: 'Não autorizado' })
    return
  }
  res.json(serializeCurrentUser(user))
})

router.put('/me/company', requireAuth, async (req, res) => {
  const user = await requireRootUser(req, res)
  if (!user) return
  const companyId = Number(req.body.companyId)
  if (!Number.isInteger(companyId) || companyId <= 0) {
    res.status(400).json({ error: 'Empresa inválida' })
    return
  }
  const company = await AppDataSource.getRepository(Company).findOneBy({ id: companyId })
  if (!company) {
    res.status(404).json({ error: 'Empresa não encontrada' })
    return
  }
  user.companyId = company.id
  user.company = company
  res.json({
    token: createAuthToken(user, company.id),
    user: serializeCurrentUser(user),
  })
})

router.get('/companies', requireAuth, async (req, res) => {
  const user = await requireRootUser(req, res)
  if (!user) return
  const companies = await AppDataSource.getRepository(Company).find({ order: { name: 'ASC' } })
  res.json(companies.map(serializeCompany))
})

router.get('/companies/:id', requireAuth, async (req, res) => {
  const user = await requireRootUser(req, res)
  if (!user) return
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Empresa inválida' })
    return
  }
  const company = await AppDataSource.getRepository(Company).findOneBy({ id })
  if (!company) {
    res.status(404).json({ error: 'Empresa não encontrada' })
    return
  }
  res.json(serializeCompany(company))
})

router.get('/companies/:id/logo', requireAuth, async (req, res) => {
  const user = await requireCurrentUser(req, res)
  if (!user) return
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Empresa inválida' })
    return
  }
  if (!user.root && user.companyId !== id) {
    res.status(403).json({ error: 'Acesso negado à logomarca desta empresa' })
    return
  }
  const company = await AppDataSource.getRepository(Company)
    .createQueryBuilder('company')
    .addSelect('company.logo')
    .where('company.id = :id', { id })
    .getOne()
  if (!company?.logo || !company.logoMimeType) {
    res.status(404).json({ error: 'Logomarca não encontrada' })
    return
  }
  res.setHeader('Content-Type', company.logoMimeType)
  res.setHeader('Cache-Control', 'private, max-age=86400')
  res.send(company.logo)
})

router.post('/companies', requireAuth, async (req, res) => {
  const user = await requireRootUser(req, res)
  if (!user) return
  const name = normalizeText(req.body.name)
  if (!name) {
    res.status(400).json({ error: 'Nome da empresa é obrigatório' })
    return
  }
  let logo
  try {
    logo = parseCompanyLogo(req.body.logoDataUrl)
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Logomarca inválida' })
    return
  }
  const company = AppDataSource.getRepository(Company).create({
    name,
    theme: normalizeTheme(req.body.theme),
    logo: logo?.data ?? null,
    logoMimeType: logo?.mimeType ?? null,
    whatsappNumber: normalizeWhatsappNumber(req.body.whatsappNumber),
    dashboardConfig: req.body.dashboardConfig
      ? normalizeDashboardConfig(req.body.dashboardConfig)
      : { widgets: [...DEFAULT_DASHBOARD_WIDGETS] },
  })
  try {
    res.status(201).json(serializeCompany(await AppDataSource.getRepository(Company).save(company)))
  } catch (error) {
    if (isDatabaseError(error, '23505')) {
      res.status(409).json({ error: 'Este número de WhatsApp já está associado a outra empresa' })
      return
    }
    throw error
  }
})

router.put('/companies/:id', requireAuth, async (req, res) => {
  const user = await requireRootUser(req, res)
  if (!user) return
  const id = Number(req.params.id)
  const name = normalizeText(req.body.name)
  if (!Number.isInteger(id) || id <= 0 || !name) {
    res.status(400).json({ error: 'Empresa ou nome inválido' })
    return
  }
  const repository = AppDataSource.getRepository(Company)
  const company = await repository.findOneBy({ id })
  if (!company) {
    res.status(404).json({ error: 'Empresa não encontrada' })
    return
  }
  company.name = name
  company.theme = normalizeTheme(req.body.theme)
  try {
    const logo = parseCompanyLogo(req.body.logoDataUrl)
    if (logo !== undefined) {
      company.logo = logo?.data ?? null
      company.logoMimeType = logo?.mimeType ?? null
    }
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Logomarca inválida' })
    return
  }
  company.whatsappNumber = normalizeWhatsappNumber(req.body.whatsappNumber)
  if (req.body.dashboardConfig !== undefined) {
    company.dashboardConfig = normalizeDashboardConfig(req.body.dashboardConfig)
  }
  try {
    res.json(serializeCompany(await repository.save(company)))
  } catch (error) {
    if (isDatabaseError(error, '23505')) {
      res.status(409).json({ error: 'Este número de WhatsApp já está associado a outra empresa' })
      return
    }
    throw error
  }
})

router.delete('/companies/:id', requireAuth, async (req, res) => {
  const user = await requireRootUser(req, res)
  if (!user) return
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Empresa inválida' })
    return
  }
  if (id === 1) {
    res.status(400).json({ error: 'A empresa padrão não pode ser excluída' })
    return
  }
  if (id === user.companyId) {
    res.status(400).json({ error: 'Troque de empresa antes de excluir a empresa atual' })
    return
  }
  try {
    const result = await AppDataSource.getRepository(Company).delete(id)
    if (!result.affected) {
      res.status(404).json({ error: 'Empresa não encontrada' })
      return
    }
    res.status(204).send()
  } catch (error) {
    if (isDatabaseError(error, '23503')) {
      res.status(409).json({ error: 'Não é possível excluir uma empresa com dados vinculados' })
      return
    }
    throw error
  }
})

router.get('/users', requireAuth, async (req, res) => {
  const currentUser = await requireCurrentUser(req, res)
  if (!currentUser) return
  const users = await AppDataSource.getRepository(User).find({
    where: { companyId: currentUser.companyId },
    relations: ['company'],
    order: { name: 'ASC' },
  })
  res.json(users.map(serializeUser))
})

router.post('/users', requireAuth, async (req, res) => {
  const currentUser = await requireRootUser(req, res)
  if (!currentUser) return
  const name = normalizeText(req.body.name)
  const username = normalizeText(req.body.username).toLowerCase()
  const email = normalizeNullableText(req.body.email)
  const password = typeof req.body.password === 'string' ? req.body.password : ''
  if (!name || !username || password.length < 8) {
    res
      .status(400)
      .json({ error: 'Nome, usuário e senha com ao menos 8 caracteres são obrigatórios' })
    return
  }
  const repository = AppDataSource.getRepository(User)
  const user = repository.create({
    name,
    username,
    email,
    password: await hashPassword(password),
    companyId: currentUser.companyId,
    root: false,
  })
  try {
    const saved = await repository.save(user)
    const complete = await repository.findOneOrFail({
      where: { id: saved.id },
      relations: ['company'],
    })
    res.status(201).json(serializeUser(complete))
  } catch (error) {
    if (isDatabaseError(error, '23505')) {
      res.status(409).json({ error: 'Usuário ou e-mail já cadastrado' })
      return
    }
    throw error
  }
})

router.get('/users/:id', requireAuth, async (req, res) => {
  if (!UUID_PATTERN.test(req.params.id)) {
    res.status(400).json({ error: 'Usuário inválido' })
    return
  }
  const currentUser = await requireCurrentUser(req, res)
  if (!currentUser) return
  const user = await AppDataSource.getRepository(User).findOne({
    where: { id: req.params.id, companyId: currentUser.companyId },
    relations: ['company'],
  })
  if (!user) {
    res.status(404).json({ error: 'Usuário não encontrado' })
    return
  }
  res.json(serializeUser(user))
})

router.put('/users/:id', requireAuth, async (req, res) => {
  if (!UUID_PATTERN.test(req.params.id)) {
    res.status(400).json({ error: 'Usuário inválido' })
    return
  }
  const currentUser = await requireRootUser(req, res)
  if (!currentUser) return
  const repository = AppDataSource.getRepository(User)
  const user = await repository.findOne({
    where: { id: req.params.id, companyId: currentUser.companyId },
    relations: ['company'],
  })
  if (!user) {
    res.status(404).json({ error: 'Usuário não encontrado' })
    return
  }
  const name = normalizeText(req.body.name)
  const username = normalizeText(req.body.username).toLowerCase()
  const password = typeof req.body.password === 'string' ? req.body.password : ''
  if (!name || !username || (password && password.length < 8)) {
    res
      .status(400)
      .json({
        error: 'Nome e usuário são obrigatórios; a nova senha deve ter ao menos 8 caracteres',
      })
    return
  }
  user.name = name
  user.username = username
  user.email = normalizeNullableText(req.body.email)
  if (password) user.password = await hashPassword(password)
  try {
    res.json(serializeUser(await repository.save(user)))
  } catch (error) {
    if (isDatabaseError(error, '23505')) {
      res.status(409).json({ error: 'Usuário ou e-mail já cadastrado' })
      return
    }
    throw error
  }
})

router.delete('/users/:id', requireAuth, async (req, res) => {
  if (!UUID_PATTERN.test(req.params.id)) {
    res.status(400).json({ error: 'Usuário inválido' })
    return
  }
  const currentUser = await requireRootUser(req, res)
  if (!currentUser) return
  if (currentUser.id === req.params.id) {
    res.status(400).json({ error: 'Você não pode excluir o próprio usuário' })
    return
  }
  const repository = AppDataSource.getRepository(User)
  const target = await repository.findOneBy({
    id: req.params.id,
    companyId: currentUser.companyId,
  })
  if (!target) {
    res.status(404).json({ error: 'Usuário não encontrado' })
    return
  }
  if (target.root) {
    res.status(400).json({ error: 'Usuários root não podem ser excluídos' })
    return
  }
  await repository.delete(target.id)
  res.status(204).send()
})

router.get('/clients', requireAuth, async (req, res) => {
  const currentUser = await requireCurrentUser(req, res)
  if (!currentUser) return
  res.json(
    await AppDataSource.getRepository(Client).find({
      where: { companyId: currentUser.companyId },
      order: { name: 'ASC' },
    }),
  )
})

router.get('/clients/:id', requireAuth, async (req, res) => {
  if (!UUID_PATTERN.test(req.params.id)) {
    res.status(400).json({ error: 'Cliente inválido' })
    return
  }
  const currentUser = await requireCurrentUser(req, res)
  if (!currentUser) return
  const client = await AppDataSource.getRepository(Client).findOneBy({
    id: req.params.id,
    companyId: currentUser.companyId,
  })
  if (!client) {
    res.status(404).json({ error: 'Cliente não encontrado' })
    return
  }
  res.json(client)
})

router.post('/clients', requireAuth, async (req, res) => {
  const currentUser = await requireCurrentUser(req, res)
  if (!currentUser) return
  const name = normalizeText(req.body.name)
  if (!name) {
    res.status(400).json({ error: 'Nome do cliente é obrigatório' })
    return
  }
  if (name.length > 200) {
    res.status(400).json({ error: 'Nome do cliente excede 200 caracteres' })
    return
  }
  const repository = AppDataSource.getRepository(Client)
  const client = repository.create({
    name,
    companyId: currentUser.companyId,
  })
  try {
    applyClientProfileInput(client, req.body)
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Dados do cliente inválidos' })
    return
  }
  res.status(201).json(await repository.save(client))
})

router.put('/clients/:id', requireAuth, async (req, res) => {
  if (!UUID_PATTERN.test(req.params.id)) {
    res.status(400).json({ error: 'Cliente inválido' })
    return
  }
  const currentUser = await requireCurrentUser(req, res)
  if (!currentUser) return
  const repository = AppDataSource.getRepository(Client)
  const client = await repository.findOneBy({ id: req.params.id, companyId: currentUser.companyId })
  if (!client) {
    res.status(404).json({ error: 'Cliente não encontrado' })
    return
  }
  const name = normalizeText(req.body.name)
  if (!name) {
    res.status(400).json({ error: 'Nome do cliente é obrigatório' })
    return
  }
  if (name.length > 200) {
    res.status(400).json({ error: 'Nome do cliente excede 200 caracteres' })
    return
  }
  client.name = name
  try {
    applyClientProfileInput(client, req.body)
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Dados do cliente inválidos' })
    return
  }
  res.json(await repository.save(client))
})

router.delete('/clients/:id', requireAuth, async (req, res) => {
  if (!UUID_PATTERN.test(req.params.id)) {
    res.status(400).json({ error: 'Cliente inválido' })
    return
  }
  const currentUser = await requireCurrentUser(req, res)
  if (!currentUser) return
  try {
    const result = await AppDataSource.getRepository(Client).delete({
      id: req.params.id,
      companyId: currentUser.companyId,
    })
    if (!result.affected) {
      res.status(404).json({ error: 'Cliente não encontrado' })
      return
    }
    res.status(204).send()
  } catch (error) {
    if (isDatabaseError(error, '23503')) {
      res.status(409).json({ error: 'Não é possível excluir um cliente com processos ativos' })
      return
    }
    throw error
  }
})

router.use(leadsRouter)
router.use(casesRouter)
router.use(dashboardRouter)

export default router
