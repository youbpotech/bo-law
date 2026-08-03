import { createPublicKey, verify } from 'node:crypto'

export const RESOURCE_KEYS = [
  'dashboard',
  'users',
  'roles',
  'clients',
  'companies',
  'leads',
  'cases',
  'niss',
  'aima',
] as const
export type ResourceKey = (typeof RESOURCE_KEYS)[number]

export interface AuthTokenPayload {
  sub?: string
  preferred_username?: string
  companyId?: number | string
  exp: number
  iss: string
  realm_access?: { roles?: string[] }
  resource_access?: Record<string, { roles?: string[] }>
}

type Jwk = { kid: string; kty: string; n: string; e: string; alg?: string; use?: string }
let cachedKeys: { expiresAt: number; keys: Jwk[] } | null = null

function keycloakUrl(): string {
  return (process.env.KEYCLOAK_URL || 'http://localhost:8081').replace(/\/$/, '')
}

function realm(): string {
  return process.env.KEYCLOAK_REALM || 'bo-law'
}

function clientId(): string {
  return process.env.KEYCLOAK_CLIENT_ID || 'bo-law-api'
}

function decodePart<T>(value: string): T {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T
}

async function getKeys(): Promise<Jwk[]> {
  if (cachedKeys && cachedKeys.expiresAt > Date.now()) return cachedKeys.keys
  const response = await fetch(`${keycloakUrl()}/realms/${encodeURIComponent(realm())}/protocol/openid-connect/certs`)
  if (!response.ok) throw new Error('Não foi possível consultar as chaves do Keycloak')
  const body = (await response.json()) as { keys?: Jwk[] }
  cachedKeys = { keys: body.keys ?? [], expiresAt: Date.now() + 5 * 60_000 }
  return cachedKeys.keys
}

export async function verifyAuthToken(token: string): Promise<AuthTokenPayload | null> {
  const [encodedHeader, encodedPayload, signature] = token.split('.')
  if (!encodedHeader || !encodedPayload || !signature) return null
  try {
    const header = decodePart<{ alg?: string; kid?: string }>(encodedHeader)
    const payload = decodePart<AuthTokenPayload>(encodedPayload)
    if (
      header.alg !== 'RS256' ||
      !header.kid ||
      (!payload.sub && !payload.preferred_username) ||
      payload.exp <= Date.now() / 1000
    )
      return null
    const expectedIssuer = `${keycloakUrl()}/realms/${realm()}`
    if (payload.iss !== expectedIssuer) return null
    const jwk = (await getKeys()).find((candidate) => candidate.kid === header.kid)
    if (!jwk) return null
    const publicKey = createPublicKey({ key: jwk, format: 'jwk' })
    return verify(
      'RSA-SHA256',
      Buffer.from(`${encodedHeader}.${encodedPayload}`),
      publicKey,
      Buffer.from(signature, 'base64url'),
    )
      ? payload
      : null
  } catch {
    return null
  }
}

export function getTokenPermissions(payload: AuthTokenPayload): ResourceKey[] {
  const assigned = payload.resource_access?.[clientId()]?.roles ?? []
  return RESOURCE_KEYS.filter((key) => assigned.includes(key))
}

export function isPlatformRoot(payload: AuthTokenPayload): boolean {
  return payload.realm_access?.roles?.includes('platform-root') ?? false
}

export async function loginWithKeycloak(username: string, password: string) {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: clientId(),
    username,
    password,
    scope: 'openid profile email roles',
  })
  const response = await fetch(
    `${keycloakUrl()}/realms/${encodeURIComponent(realm())}/protocol/openid-connect/token`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body },
  )
  if (!response.ok) return null
  return (await response.json()) as { access_token: string; expires_in: number; refresh_token?: string }
}
