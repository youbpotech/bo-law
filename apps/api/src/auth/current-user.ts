import { Request, Response } from 'express'
import { AppDataSource } from '../data-source'
import { Company } from '../entities/Company'
import { User } from '../entities/User'
import { verifyAuthToken } from './token'

export function getAuthPayload(req: Request) {
  const authorization = req.header('authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null
  return token ? verifyAuthToken(token) : null
}

export async function getCurrentUser(req: Request): Promise<User | null> {
  const payload = getAuthPayload(req)

  if (!payload) return null

  const user = await AppDataSource.getRepository(User).findOneBy({ id: payload.sub })
  if (!user) return null

  const companyId = user.root && payload.companyId ? payload.companyId : user.companyId
  const company = await AppDataSource.getRepository(Company).findOneBy({ id: companyId })
  if (!company) return null

  user.companyId = company.id
  user.company = company
  return user
}

export async function requireCurrentUser(req: Request, res: Response): Promise<User | null> {
  const user = await getCurrentUser(req)

  if (!user) res.status(401).json({ error: 'Não autorizado' })

  return user
}

export async function requireRootUser(req: Request, res: Response): Promise<User | null> {
  const user = await requireCurrentUser(req, res)

  if (user && !user.root) {
    res.status(403).json({ error: 'Apenas usuários root podem acessar empresas' })
    return null
  }

  return user
}

export function serializeCurrentUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    companyId: user.companyId,
    root: user.root,
    company: user.company
      ? {
          id: user.company.id,
          name: user.company.name,
          theme: user.company.theme,
          hasLogo: Boolean(user.company.logoMimeType),
          logoUrl: user.company.logoMimeType
            ? `/api/companies/${user.company.id}/logo?v=${user.company.updatedAt.getTime()}`
            : null,
          whatsappNumber: user.company.whatsappNumber,
          dashboardConfig: user.company.dashboardConfig,
        }
      : null,
  }
}
