import { Request, Response } from 'express'
import { AppDataSource } from '../data-source'
import { Company } from '../entities/Company'
import { User } from '../entities/User'
import {
  getTokenPermissions,
  isPlatformRoot,
  type ResourceKey,
  verifyAuthToken,
} from './token'

export async function getAuthPayload(req: Request) {
  const authorization = req.header('authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null
  return token ? verifyAuthToken(token) : null
}

export async function getCurrentUser(req: Request): Promise<User | null> {
  const payload = await getAuthPayload(req)
  if (!payload) return null

  const userRepository = AppDataSource.getRepository(User)
  const user = payload.sub
    ? await userRepository.findOneBy({ keycloakId: payload.sub })
    : await userRepository
        .createQueryBuilder('user')
        .where('LOWER(user.username) = LOWER(:username)', {
          username: payload.preferred_username,
        })
        .getOne()
  if (!user) return null

  const platformRoot = isPlatformRoot(payload)
  const requestedCompanyId = Number(req.header('x-company-id'))
  const companyId =
    platformRoot && Number.isInteger(requestedCompanyId) && requestedCompanyId > 0
      ? requestedCompanyId
      : user.companyId
  if (!Number.isInteger(companyId) || companyId <= 0) return null
  const company = await AppDataSource.getRepository(Company).findOneBy({ id: companyId })
  if (!company) return null

  user.companyId = company.id
  user.company = company
  user.root = platformRoot
  user.permissions = platformRoot
    ? [...new Set([...getTokenPermissions(payload), 'companies'])]
    : getTokenPermissions(payload)
  user.roleRoot =
    platformRoot ||
    (payload.realm_access?.roles?.includes(`company-${company.id}-root`) ?? false)
  return user
}

export async function requireCurrentUser(req: Request, res: Response): Promise<User | null> {
  const user = await getCurrentUser(req)
  if (!user) res.status(401).json({ error: 'Não autorizado' })
  return user
}

export async function requireResourceUser(
  req: Request,
  res: Response,
  resource: ResourceKey,
): Promise<User | null> {
  const user = await requireCurrentUser(req, res)
  if (!user) return null
  if (!user.root && !user.permissions?.includes(resource)) {
    res.status(403).json({ error: 'Você não possui permissão para este recurso' })
    return null
  }
  return user
}

export async function requireRoleRootUser(req: Request, res: Response): Promise<User | null> {
  const user = await requireCurrentUser(req, res)
  if (user && !user.roleRoot) {
    res.status(403).json({ error: 'Apenas usuários com a Role Root podem realizar esta operação' })
    return null
  }
  return user
}

export async function requireRootUser(req: Request, res: Response): Promise<User | null> {
  const user = await requireCurrentUser(req, res)
  if (user && !user.root) {
    res.status(403).json({ error: 'Apenas administradores globais podem acessar empresas' })
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
    roleRoot: user.roleRoot,
    permissions: user.permissions ?? [],
    company: user.company
      ? {
          id: user.company.id,
          name: user.company.name,
          theme: user.company.theme,
          hasLogo: Boolean(user.company.logoMimeType),
          logoUrl: user.company.logoMimeType
            ? `/api/companies/${user.company.id}/logo?v=${user.company.updatedAt.getTime()}`
            : null,
          hasFavicon: Boolean(user.company.faviconMimeType),
          faviconUrl: user.company.faviconMimeType
            ? `/api/branding/companies/${user.company.id}/favicon?v=${user.company.updatedAt.getTime()}`
            : null,
          whatsappNumber: user.company.whatsappNumber,
          dashboardConfig: user.company.dashboardConfig,
        }
      : null,
  }
}
