import { createHmac, timingSafeEqual } from 'node:crypto'

export interface AuthTokenPayload {
  sub: string
  username: string
  companyId?: number
  exp: number
}

const TOKEN_DURATION_SECONDS = 60 * 60 * 8

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET

  if (secret && (process.env.NODE_ENV !== 'production' || secret.length >= 32)) {
    return secret
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET precisa ter ao menos 32 caracteres em produção')
  }

  return 'bo-law-development-secret'
}

function sign(value: string): string {
  return createHmac('sha256', getAuthSecret()).update(value).digest('base64url')
}

export function createAuthToken(
  user: { id: string; username: string; companyId: number },
  companyId = user.companyId,
): string {
  const payload: AuthTokenPayload = {
    sub: user.id,
    username: user.username,
    companyId,
    exp: Math.floor(Date.now() / 1000) + TOKEN_DURATION_SECONDS,
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')

  return `${encodedPayload}.${sign(encodedPayload)}`
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  const [encodedPayload, signature] = token.split('.')

  if (!encodedPayload || !signature) {
    return null
  }

  const expectedSignature = Buffer.from(sign(encodedPayload))
  const receivedSignature = Buffer.from(signature)

  if (
    expectedSignature.length !== receivedSignature.length ||
    !timingSafeEqual(expectedSignature, receivedSignature)
  ) {
    return null
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as AuthTokenPayload

    if (
      !payload.sub ||
      !payload.username ||
      (payload.companyId !== undefined &&
        (!Number.isInteger(payload.companyId) || payload.companyId <= 0)) ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null
    }

    return payload
  } catch {
    return null
  }
}
