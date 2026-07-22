import { describe, expect, it } from 'vitest'
import { getTokenPermissions, isPlatformRoot, type AuthTokenPayload } from './token'

function payload(overrides: Partial<AuthTokenPayload> = {}): AuthTokenPayload {
  return {
    preferred_username: 'user',
    exp: Math.floor(Date.now() / 1000) + 60,
    iss: 'http://keycloak/realms/bo-law',
    ...overrides,
  }
}

describe('permissões Keycloak', () => {
  it('extrai somente as roles técnicas conhecidas do cliente da API', () => {
    const token = payload({
      resource_access: {
        'bo-law-api': { roles: ['clients', 'leads', 'role-desconhecida'] },
      },
    })

    expect(getTokenPermissions(token)).toEqual(['clients', 'leads'])
  })

  it('reconhece exclusivamente a role global platform-root', () => {
    expect(isPlatformRoot(payload({ realm_access: { roles: ['platform-root'] } }))).toBe(true)
    expect(isPlatformRoot(payload({ realm_access: { roles: ['company-1-root'] } }))).toBe(false)
  })
})
