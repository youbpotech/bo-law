import { AppDataSource } from '../data-source'
import { Company } from '../entities/Company'
import {
  Notification,
  type NotificationChannel,
  type NotificationStatus,
} from '../entities/Notification'
import { NotificationDelivery } from '../entities/NotificationDelivery'
import { User } from '../entities/User'
import { toNotificationChannelSet } from './channel-set'
import { notificationConfig } from './config'
import type { NotifyInput, NotifyRecipient } from './contracts'
import { notificationChannelFactory } from './default-factory'

function normalizeRequiredText(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error(`${field} é obrigatório`)
  return normalized
}

function recipientForChannel(
  channel: NotificationChannel,
  recipient: NotifyRecipient,
  user: User | null,
): string {
  if (channel === 'internal') {
    if (!user) throw new Error('O canal interno exige um usuário destinatário')
    return user.id
  }
  if (channel === 'email') {
    const email = recipient.email?.trim() || user?.email?.trim()
    if (!email) throw new Error('O canal email exige um endereço de email')
    return email
  }
  const phone = recipient.phone?.trim()
  if (!phone) throw new Error('O canal WhatsApp exige um número de telefone')
  return phone
}

async function updateNotificationStatus(notificationId: string): Promise<void> {
  const rows: Array<{ status: string; count: string }> = await AppDataSource.query(
    `SELECT "status", count(*)::text AS "count"
       FROM "bo"."notification_deliveries"
      WHERE "notification_id" = $1
      GROUP BY "status"`,
    [notificationId],
  )
  const counts = Object.fromEntries(rows.map((row) => [row.status, Number(row.count)]))
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
  const sent = counts.sent ?? 0
  const failed = counts.failed ?? 0
  let status: NotificationStatus = 'pending'
  if (total > 0 && sent === total) status = 'sent'
  else if (total > 0 && failed === total) status = 'failed'
  else if (sent > 0 || failed > 0) status = 'partial'
  await AppDataSource.getRepository(Notification).update(notificationId, { status })
}

export async function processNotificationDelivery(deliveryId: string): Promise<boolean> {
  const claimed: Array<{ id: string }> = await AppDataSource.query(
    `UPDATE "bo"."notification_deliveries"
        SET "status" = 'processing', "attempts" = "attempts" + 1, "updated_at" = now()
      WHERE "id" = $1 AND "status" = 'pending' AND "next_attempt_at" <= now()
      RETURNING "id"`,
    [deliveryId],
  )
  if (!claimed[0]) return false

  const delivery = await AppDataSource.getRepository(NotificationDelivery).findOne({
    where: { id: deliveryId },
    relations: ['notification', 'notification.company'],
  })
  if (!delivery) return false

  try {
    const adapter = notificationChannelFactory.get(delivery.channel)
    const result = await adapter.send({
      notificationId: delivery.notificationId,
      deliveryId: delivery.id,
      companyId: delivery.notification.companyId,
      channel: delivery.channel,
      recipient: delivery.recipient,
      title: delivery.notification.title,
      body: delivery.notification.body,
      metadata: delivery.notification.metadata,
      whatsappFrom: delivery.notification.company.whatsappNumber,
    })
    await AppDataSource.getRepository(NotificationDelivery).update(delivery.id, {
      status: 'sent',
      providerMessageId: result.providerMessageId ?? null,
      lastError: null,
      sentAt: new Date(),
    })
  } catch (error) {
    const finalFailure = delivery.attempts >= notificationConfig.maxAttempts
    const retryDelayMs = Math.min(60 * 60_000, 2 ** delivery.attempts * 30_000)
    await AppDataSource.getRepository(NotificationDelivery).update(delivery.id, {
      status: finalFailure ? 'failed' : 'pending',
      lastError: (error instanceof Error ? error.message : 'Falha desconhecida').slice(0, 2_000),
      nextAttemptAt: new Date(Date.now() + retryDelayMs),
    })
  }
  await updateNotificationStatus(delivery.notificationId)
  return true
}

export async function dispatchNotification(notificationId: string): Promise<void> {
  const deliveries = await AppDataSource.getRepository(NotificationDelivery).findBy({
    notificationId,
    status: 'pending',
  })
  await Promise.all(deliveries.map((delivery) => processNotificationDelivery(delivery.id)))
}

export async function notify(input: NotifyInput): Promise<Notification> {
  const channels = toNotificationChannelSet(input.channels)
  const title = normalizeRequiredText(input.title, 'Título')
  const body = normalizeRequiredText(input.body, 'Mensagem')
  if (title.length > 255) throw new Error('O título da notificação excede 255 caracteres')

  const user = input.recipient.userId
    ? await AppDataSource.getRepository(User).findOneBy({
        id: input.recipient.userId,
        companyId: input.companyId,
      })
    : null
  if (input.recipient.userId && !user) {
    throw new Error('Usuário destinatário não encontrado nesta empresa')
  }

  const recipients = new Map(
    [...channels].map((channel) => [
      channel,
      recipientForChannel(channel, input.recipient, user),
    ]),
  )

  const notification = await AppDataSource.transaction(async (manager) => {
    if (!(await manager.getRepository(Company).existsBy({ id: input.companyId }))) {
      throw new Error('Empresa da notificação não encontrada')
    }
    const created = await manager.getRepository(Notification).save(
      manager.getRepository(Notification).create({
        companyId: input.companyId,
        recipientUserId: user?.id ?? null,
        createdByUserId: input.createdByUserId ?? null,
        title,
        body,
        channels: [...channels],
        status: 'pending',
        metadata: input.metadata ?? {},
        readAt: null,
      }),
    )
    await manager.getRepository(NotificationDelivery).save(
      [...channels].map((channel) =>
        manager.getRepository(NotificationDelivery).create({
          notificationId: created.id,
          channel,
          recipient: recipients.get(channel)!,
          status: 'pending',
          attempts: 0,
          providerMessageId: null,
          lastError: null,
          nextAttemptAt: new Date(),
          sentAt: null,
        }),
      ),
    )
    return created
  })

  await dispatchNotification(notification.id)
  return AppDataSource.getRepository(Notification).findOneOrFail({
    where: { id: notification.id },
    relations: ['deliveries'],
  })
}
