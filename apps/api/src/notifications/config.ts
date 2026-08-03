import { config as loadEnv } from 'dotenv'

loadEnv()

function numberFromEnvironment(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const notificationConfig = {
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: numberFromEnvironment(process.env.SMTP_PORT, 587),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPassword: process.env.SMTP_PASSWORD ?? '',
  emailFrom: process.env.NOTIFICATION_EMAIL_FROM ?? '',
  pollMs: numberFromEnvironment(process.env.NOTIFICATION_WORKER_POLL_MS, 3_000),
  maxAttempts: numberFromEnvironment(process.env.NOTIFICATION_MAX_ATTEMPTS, 5),
}
