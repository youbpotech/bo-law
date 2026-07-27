import { randomUUID } from 'node:crypto'
import { RESOURCE_KEYS, type ResourceKey } from './auth/token'

type KeycloakRole = {
  id: string
  name: string
  description?: string
  clientRole?: boolean
  containerId?: string
  attributes?: Record<string, string[]>
}

export type ManagedRole = {
  id: string
  name: string
  description: string | null
  isRoot: boolean
  resources: ResourceKey[]
}

const baseUrl = () => (process.env.KEYCLOAK_URL || 'http://localhost:8081').replace(/\/$/, '')
const realm = () => process.env.KEYCLOAK_REALM || 'bo-law'
const clientId = () => process.env.KEYCLOAK_CLIENT_ID || 'bo-law-api'
let adminToken: { value: string; expiresAt: number } | null = null

async function getAdminToken(): Promise<string> {
  if (adminToken && adminToken.expiresAt > Date.now()) return adminToken.value
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: 'admin-cli',
    username: process.env.KEYCLOAK_ADMIN || 'admin',
    password: process.env.KEYCLOAK_ADMIN_PASSWORD || 'keycloak-local-admin-change-me',
  })
  const response = await fetch(`${baseUrl()}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!response.ok) throw new Error('Não foi possível autenticar na Admin API do Keycloak')
  const token = (await response.json()) as { access_token: string; expires_in: number }
  adminToken = { value: token.access_token, expiresAt: Date.now() + (token.expires_in - 15) * 1000 }
  return adminToken.value
}

async function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl()}/admin/realms/${encodeURIComponent(realm())}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await getAdminToken()}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Keycloak recusou a operação (${response.status})${detail ? `: ${detail}` : ''}`)
  }
  if (response.status === 204 || response.headers.get('content-length') === '0') return undefined as T
  return response.json() as Promise<T>
}

async function getApiClient() {
  const clients = await adminRequest<Array<{ id: string; clientId: string }>>(
    `/clients?clientId=${encodeURIComponent(clientId())}`,
  )
  const client = clients.find((candidate) => candidate.clientId === clientId())
  if (!client) throw new Error('Cliente da API não encontrado no Keycloak')
  return client
}

async function getResourceRoles(): Promise<KeycloakRole[]> {
  const client = await getApiClient()
  let roles = await adminRequest<KeycloakRole[]>(`/clients/${client.id}/roles`)
  for (const resource of RESOURCE_KEYS.filter((key) => !roles.some((role) => role.name === key))) {
    await adminRequest(`/clients/${client.id}/roles`, {
      method: 'POST',
      body: JSON.stringify({ name: resource, description: `Acesso ao recurso ${resource}` }),
    })
  }
  roles = await adminRequest<KeycloakRole[]>(`/clients/${client.id}/roles`)
  return roles.filter((role) => RESOURCE_KEYS.includes(role.name as ResourceKey))
}

async function getRealmRole(name: string): Promise<KeycloakRole | null> {
  try {
    return await adminRequest<KeycloakRole>(`/roles/${encodeURIComponent(name)}`)
  } catch (error) {
    if (error instanceof Error && error.message.includes('(404)')) return null
    throw error
  }
}

async function setRoleResources(role: KeycloakRole, resources: ResourceKey[]): Promise<void> {
  const current = await adminRequest<KeycloakRole[]>(`/roles-by-id/${role.id}/composites`)
  const resourceRoles = await getResourceRoles()
  const managedCurrent = current.filter((item) => RESOURCE_KEYS.includes(item.name as ResourceKey))
  if (managedCurrent.length) {
    await adminRequest(`/roles-by-id/${role.id}/composites`, {
      method: 'DELETE',
      body: JSON.stringify(managedCurrent),
    })
  }
  const selected = resourceRoles.filter((item) => resources.includes(item.name as ResourceKey))
  if (selected.length) {
    await adminRequest(`/roles-by-id/${role.id}/composites`, {
      method: 'POST',
      body: JSON.stringify(selected),
    })
  }
}

function roleName(companyId: number, isRoot = false): string {
  return isRoot ? `company-${companyId}-root` : `company-${companyId}-${randomUUID()}`
}

async function serializeRole(role: KeycloakRole): Promise<ManagedRole> {
  const composites = await adminRequest<KeycloakRole[]>(`/roles-by-id/${role.id}/composites`)
  return {
    id: role.id,
    name: role.attributes?.displayName?.[0] || role.name,
    description: role.description || null,
    isRoot: role.attributes?.isRoot?.[0] === 'true',
    resources: RESOURCE_KEYS.filter((key) => composites.some((item) => item.name === key)),
  }
}

export async function ensureCompanyRootRole(companyId: number): Promise<ManagedRole> {
  const internalName = roleName(companyId, true)
  let role = await getRealmRole(internalName)
  if (!role) {
    await adminRequest('/roles', {
      method: 'POST',
      body: JSON.stringify({
        name: internalName,
        description: 'Role Root da empresa',
        composite: true,
        attributes: { companyId: [String(companyId)], displayName: ['Root'], isRoot: ['true'] },
      }),
    })
    role = await getRealmRole(internalName)
  }
  if (!role) throw new Error('Não foi possível criar a Role Root no Keycloak')
  await setRoleResources(role, [...RESOURCE_KEYS])
  return serializeRole(role)
}

export async function listCompanyRoles(companyId: number): Promise<ManagedRole[]> {
  const roles = await adminRequest<KeycloakRole[]>('/roles?briefRepresentation=false')
  return Promise.all(
    roles
      .filter((role) => role.attributes?.companyId?.includes(String(companyId)))
      .map(serializeRole),
  )
}

export async function createCompanyRole(
  companyId: number,
  input: { name: string; description?: string | null; resources: ResourceKey[] },
): Promise<ManagedRole> {
  const internalName = roleName(companyId)
  await adminRequest('/roles', {
    method: 'POST',
    body: JSON.stringify({
      name: internalName,
      description: input.description || undefined,
      composite: true,
      attributes: { companyId: [String(companyId)], displayName: [input.name], isRoot: ['false'] },
    }),
  })
  const role = await getRealmRole(internalName)
  if (!role) throw new Error('Não foi possível criar a role no Keycloak')
  await setRoleResources(role, input.resources)
  return serializeRole(role)
}

export async function updateCompanyRole(
  companyId: number,
  id: string,
  input: { name: string; description?: string | null; resources: ResourceKey[] },
): Promise<ManagedRole> {
  const roles = await adminRequest<KeycloakRole[]>('/roles?briefRepresentation=false')
  const role = roles.find((candidate) => candidate.id === id && candidate.attributes?.companyId?.includes(String(companyId)))
  if (!role) throw new Error('Role não encontrada')
  if (role.attributes?.isRoot?.[0] === 'true') throw new Error('A Role Root não pode ser alterada')
  await adminRequest(`/roles-by-id/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...role, description: input.description || undefined, attributes: { ...role.attributes, displayName: [input.name] } }),
  })
  await setRoleResources(role, input.resources)
  const updated = await adminRequest<KeycloakRole>(`/roles-by-id/${id}`)
  return serializeRole(updated)
}

export async function deleteCompanyRole(companyId: number, id: string): Promise<void> {
  const roles = await adminRequest<KeycloakRole[]>('/roles?briefRepresentation=false')
  const role = roles.find((candidate) => candidate.id === id && candidate.attributes?.companyId?.includes(String(companyId)))
  if (!role) throw new Error('Role não encontrada')
  if (role.attributes?.isRoot?.[0] === 'true') throw new Error('A Role Root não pode ser excluída')
  await adminRequest(`/roles-by-id/${id}`, { method: 'DELETE' })
}

export async function createKeycloakUser(input: {
  companyId: number; name: string; username: string; email: string | null; password: string; roleIds: string[]
}): Promise<string> {
  const names = input.name.trim().split(/\s+/)
  const firstName = names.shift() || input.username
  const lastName = names.join(' ') || firstName
  const identityEmail = input.email || `${input.username}@bo-law.local`
  const response = await fetch(`${baseUrl()}/admin/realms/${encodeURIComponent(realm())}/users`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await getAdminToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: input.username, email: identityEmail, firstName, lastName, enabled: true, emailVerified: true, requiredActions: [], attributes: { companyId: [String(input.companyId)] }, credentials: [{ type: 'password', value: input.password, temporary: false }] }),
  })
  if (!response.ok) throw new Error(`Keycloak recusou a criação do usuário (${response.status})`)
  const id = response.headers.get('location')?.split('/').pop()
  if (!id) throw new Error('Keycloak não retornou o identificador do usuário')
  await setUserRoles(id, input.companyId, input.roleIds)
  return id
}

export async function setUserRoles(userId: string, companyId: number, roleIds: string[]): Promise<void> {
  const companyRoles = await adminRequest<KeycloakRole[]>('/roles?briefRepresentation=false')
  const allowed = companyRoles.filter((role) => role.attributes?.companyId?.includes(String(companyId)))
  const current = await adminRequest<KeycloakRole[]>(`/users/${userId}/role-mappings/realm`)
  const currentCompany = current.filter((role) => allowed.some((item) => item.id === role.id))
  if (currentCompany.length) await adminRequest(`/users/${userId}/role-mappings/realm`, { method: 'DELETE', body: JSON.stringify(currentCompany) })
  const selected = allowed.filter((role) => roleIds.includes(role.id))
  if (selected.length) await adminRequest(`/users/${userId}/role-mappings/realm`, { method: 'POST', body: JSON.stringify(selected) })
}

export async function getUserRoleIds(userId: string, companyId: number): Promise<string[]> {
  const roles = await adminRequest<KeycloakRole[]>(`/users/${userId}/role-mappings/realm`)
  return roles
    .filter((role) => role.attributes?.companyId?.includes(String(companyId)))
    .map((role) => role.id)
}

export async function updateKeycloakUser(userId: string, input: { companyId: number; name: string; username: string; email: string | null; password?: string; roleIds: string[] }): Promise<void> {
  const names = input.name.trim().split(/\s+/)
  const firstName = names.shift() || input.username
  const lastName = names.join(' ') || firstName
  const identityEmail = input.email || `${input.username}@bo-law.local`
  await adminRequest(`/users/${userId}`, { method: 'PUT', body: JSON.stringify({ username: input.username, email: identityEmail, firstName, lastName, enabled: true, emailVerified: true, requiredActions: [], attributes: { companyId: [String(input.companyId)] } }) })
  if (input.password) await adminRequest(`/users/${userId}/reset-password`, { method: 'PUT', body: JSON.stringify({ type: 'password', value: input.password, temporary: false }) })
  await setUserRoles(userId, input.companyId, input.roleIds)
}

export async function deleteKeycloakUser(userId: string): Promise<void> {
  await adminRequest(`/users/${userId}`, { method: 'DELETE' })
}

export async function assignPlatformRoot(userId: string): Promise<void> {
  const role = await getRealmRole('platform-root')
  if (!role) throw new Error('Role platform-root não encontrada')
  await adminRequest(`/users/${userId}/role-mappings/realm`, { method: 'POST', body: JSON.stringify([role]) })
}
