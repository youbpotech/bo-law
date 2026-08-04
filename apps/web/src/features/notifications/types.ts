export const NOTIFICATION_CHANNELS = ['internal', 'email', 'whatsapp', 'sms'] as const
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]
export type NotificationStatus = 'pending' | 'sent' | 'partial' | 'failed'

export interface NotificationChannelCatalogItem {
  channel: NotificationChannel
  supported: boolean
  implemented: boolean
  configured: boolean
  availableForUser: boolean
  reason: string | null
}

export type NotificationChannelOption = NotificationChannelCatalogItem

export interface InternalNotification {
  id: string
  companyId: number
  recipientUserId: string
  title: string
  body: string
  channels: NotificationChannel[]
  status: NotificationStatus
  metadata: Record<string, unknown>
  readAt: string | null
  createdAt: string
  updatedAt: string
}
