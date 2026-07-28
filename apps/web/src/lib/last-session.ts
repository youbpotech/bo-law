import { isColorTheme, type ColorTheme } from './color-theme'

const LAST_SESSION_COOKIE = 'bo-last-session'
const USER_SESSIONS_COOKIE = 'bo-user-sessions'
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365
const MAX_REMEMBERED_USERS = 10

export interface LastSession {
  username: string
  companyId: number
  userName?: string
  colorTheme?: ColorTheme
}

type StoredUserSession = LastSession & { updatedAt: number }
type UserSessionStore = Record<string, StoredUserSession>

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  return (
    document.cookie
      .split('; ')
      .find((entry) => entry.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? null
  )
}

function parseSession(value: unknown): LastSession | null {
  if (typeof value !== 'object' || value === null) return null
  const session = value as Partial<LastSession>
  if (
    typeof session.username !== 'string' ||
    !Number.isInteger(session.companyId) ||
    Number(session.companyId) <= 0
  ) {
    return null
  }
  return {
    username: normalizeUsername(session.username),
    companyId: Number(session.companyId),
    ...(typeof session.userName === 'string' && session.userName.trim()
      ? { userName: session.userName.trim() }
      : {}),
    ...(isColorTheme(session.colorTheme) ? { colorTheme: session.colorTheme } : {}),
  }
}

function readUserSessionStore(): UserSessionStore {
  const value = readCookie(USER_SESSIONS_COOKIE)
  if (!value) return {}
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Record<string, unknown>
    const sessions: UserSessionStore = {}
    for (const [key, candidate] of Object.entries(parsed)) {
      const session = parseSession(candidate)
      if (!session || normalizeUsername(key) !== session.username) continue
      const updatedAt =
        typeof candidate === 'object' &&
        candidate !== null &&
        'updatedAt' in candidate &&
        typeof candidate.updatedAt === 'number'
          ? candidate.updatedAt
          : 0
      sessions[session.username] = { ...session, updatedAt }
    }
    return sessions
  } catch {
    return {}
  }
}

export function getLastSession(): LastSession | null {
  const value = readCookie(LAST_SESSION_COOKIE)
  if (!value) return null
  try {
    return parseSession(JSON.parse(decodeURIComponent(value)))
  } catch {
    return null
  }
}

export function getSessionForUsername(username: string): LastSession | null {
  const normalizedUsername = normalizeUsername(username)
  if (!normalizedUsername) return null
  const stored = readUserSessionStore()[normalizedUsername]
  if (stored) return parseSession(stored)
  const legacySession = getLastSession()
  return legacySession?.username === normalizedUsername ? legacySession : null
}

export function rememberLastSession(session: LastSession): void {
  if (typeof document === 'undefined') return
  const username = normalizeUsername(session.username)
  if (!username) return
  const existing = getSessionForUsername(username)
  const normalizedSession: LastSession = {
    username,
    companyId: session.companyId,
    ...(session.userName?.trim() ? { userName: session.userName.trim() } : {}),
    ...(session.colorTheme || existing?.colorTheme
      ? { colorTheme: session.colorTheme ?? existing?.colorTheme }
      : {}),
  }
  const store = readUserSessionStore()
  store[username] = { ...normalizedSession, updatedAt: Date.now() }
  const limitedStore = Object.fromEntries(
    Object.entries(store)
      .sort(([, left], [, right]) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_REMEMBERED_USERS),
  )
  const storeValue = encodeURIComponent(JSON.stringify(limitedStore))
  document.cookie = `${USER_SESSIONS_COOKIE}=${storeValue}; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax`

  const value = encodeURIComponent(JSON.stringify(normalizedSession))
  document.cookie = `${LAST_SESSION_COOKIE}=${value}; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax`
}
