import { AppDataSource } from '../data-source'
import { notificationConfig } from './config'
import { processNotificationDelivery } from './service'

async function recoverInterruptedDeliveries(): Promise<void> {
  await AppDataSource.query(
    `UPDATE "bo"."notification_deliveries"
        SET "status" = 'pending', "next_attempt_at" = now(), "updated_at" = now()
      WHERE "status" = 'processing' AND "updated_at" < now() - interval '5 minutes'`,
  )
}

async function processPendingDeliveries(): Promise<void> {
  const rows: Array<{ id: string }> = await AppDataSource.query(
    `SELECT "id"
       FROM "bo"."notification_deliveries"
      WHERE "status" = 'pending' AND "next_attempt_at" <= now()
      ORDER BY "created_at"
      LIMIT 20`,
  )
  await Promise.all(rows.map((row) => processNotificationDelivery(row.id)))
}

export function startNotificationWorker() {
  let stopped = false
  let timer: NodeJS.Timeout | undefined
  let active: Promise<void> | undefined

  const tick = async () => {
    try {
      await recoverInterruptedDeliveries()
      await processPendingDeliveries()
    } catch (error) {
      console.error('Notification worker tick failed', error)
    } finally {
      if (!stopped) {
        timer = setTimeout(() => {
          active = tick()
        }, notificationConfig.pollMs)
      }
    }
  }
  active = tick()

  return async () => {
    stopped = true
    if (timer) clearTimeout(timer)
    await active
  }
}
