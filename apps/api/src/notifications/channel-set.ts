import {
  NOTIFICATION_CHANNELS,
  type NotificationChannel,
} from '../entities/Notification'

export function toNotificationChannelSet(values: Iterable<unknown>): Set<NotificationChannel> {
  const channels = new Set<NotificationChannel>()
  for (const value of values) {
    if (
      typeof value !== 'string' ||
      !NOTIFICATION_CHANNELS.includes(value as NotificationChannel)
    ) {
      throw new Error(`Canal de notificação inválido: ${String(value)}`)
    }
    channels.add(value as NotificationChannel)
  }
  if (channels.size === 0) throw new Error('Informe ao menos um canal de notificação')
  return channels
}
