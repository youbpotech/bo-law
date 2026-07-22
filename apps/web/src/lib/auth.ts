export const AUTH_STORAGE_KEY = 'bo-auth-token'
export const ACTIVE_COMPANY_STORAGE_KEY = 'bo-active-company-id'

interface TokenPayload {
  exp: number
}

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_STORAGE_KEY)
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_STORAGE_KEY, token)
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY)
  localStorage.removeItem(ACTIVE_COMPANY_STORAGE_KEY)
}

export function getActiveCompanyId(): number | null {
  const value = Number(localStorage.getItem(ACTIVE_COMPANY_STORAGE_KEY))
  return Number.isInteger(value) && value > 0 ? value : null
}

export function setActiveCompanyId(companyId: number): void {
  localStorage.setItem(ACTIVE_COMPANY_STORAGE_KEY, String(companyId))
}

export function isAuthenticated(): boolean {
  const token = getAuthToken()

  if (!token) {
    return false
  }

  try {
    const [, encodedPayload] = token.split('.')

    if (!encodedPayload) {
      return false
    }

    const payload = JSON.parse(
      atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/')),
    ) as TokenPayload
    return payload.exp > Math.floor(Date.now() / 1000)
  } catch {
    clearAuthToken()
    return false
  }
}
