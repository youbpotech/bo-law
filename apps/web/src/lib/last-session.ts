const LAST_SESSION_COOKIE = 'bo-last-session'
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export interface LastSession {
  username: string
  companyId: number
}

export function getLastSession(): LastSession | null {
  if (typeof document === 'undefined') return null
  const value = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${LAST_SESSION_COOKIE}=`))
    ?.slice(LAST_SESSION_COOKIE.length + 1)
  if (!value) return null
  try {
    const session = JSON.parse(decodeURIComponent(value)) as Partial<LastSession>
    return typeof session.username === 'string' && Number.isInteger(session.companyId) && Number(session.companyId) > 0
      ? { username: session.username, companyId: Number(session.companyId) }
      : null
  } catch {
    return null
  }
}

export function rememberLastSession(session: LastSession): void {
  if (typeof document === 'undefined') return
  const value = encodeURIComponent(JSON.stringify(session))
  document.cookie = `${LAST_SESSION_COOKIE}=${value}; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax`
}
