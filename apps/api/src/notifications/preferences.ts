import { EntityManager } from 'typeorm'
import { Company } from '../entities/Company'
import {
  NOTIFICATION_CHANNELS,
  type NotificationChannel,
} from '../entities/Notification'
import { User } from '../entities/User'
import { UserNotificationChannel } from '../entities/UserNotificationChannel'
import { notificationChannelCatalog } from './catalog'

export function parseNotificationChannels(
  value: unknown,
  fallback: NotificationChannel[] = ['internal'],
): NotificationChannel[] {
  if (value === undefined) return [...fallback]
  if (!Array.isArray(value)) throw new Error('Os canais de notificação são inválidos.')
  if (
    value.some(
      (channel) =>
        typeof channel !== 'string' ||
        !NOTIFICATION_CHANNELS.includes(channel as NotificationChannel),
    )
  ) {
    throw new Error('Existe um canal de notificação inválido.')
  }
  const channels = Array.from(
    new Set(
      value as NotificationChannel[],
    ),
  )
  if (!channels.length) throw new Error('Selecione ao menos um canal de notificação.')
  return channels
}

export function validateNotificationChannels(
  channels: NotificationChannel[],
  company: Company,
  user: Pick<User, 'email' | 'phone'>,
): void {
  const catalog = new Map(
    notificationChannelCatalog(company, user).map((item) => [item.channel, item]),
  )
  for (const channel of channels) {
    const item = catalog.get(channel)!
    if (!item.availableForUser) {
      throw new Error(item.reason ?? `O canal ${channel} não está disponível.`)
    }
  }
}

export async function saveNotificationChannelPreferences(
  manager: EntityManager,
  userId: string,
  enabledChannels: Iterable<NotificationChannel>,
): Promise<void> {
  const enabled = new Set(enabledChannels)
  await manager.getRepository(UserNotificationChannel).upsert(
    NOTIFICATION_CHANNELS.map((channel) => ({
      userId,
      channel,
      enabled: enabled.has(channel),
    })),
    ['userId', 'channel'],
  )
}

export async function enabledNotificationChannels(
  manager: EntityManager,
  userId: string,
): Promise<NotificationChannel[]> {
  const preferences = await manager.getRepository(UserNotificationChannel).findBy({
    userId,
    enabled: true,
  })
  return preferences.length ? preferences.map(({ channel }) => channel) : ['internal']
}
