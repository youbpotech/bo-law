import type { NotificationChannel } from '../entities/Notification'

export type NotificationMessage = {
  notificationId: string
  deliveryId: string
  companyId: number
  channel: NotificationChannel
  recipient: string
  title: string
  body: string
  metadata: Record<string, unknown>
  whatsappFrom?: string | null
}

export type NotificationDeliveryResult = {
  providerMessageId?: string
}

export interface NotificationChannelAdapter {
  readonly channel: NotificationChannel
  send(message: NotificationMessage): Promise<NotificationDeliveryResult>
}

export type NotifyRecipient = {
  userId?: string
  email?: string
  phone?: string
}

export type NotifyInput = {
  companyId: number
  channels: Iterable<NotificationChannel>
  recipient: NotifyRecipient
  title: string
  body: string
  metadata?: Record<string, unknown>
  createdByUserId?: string | null
}
