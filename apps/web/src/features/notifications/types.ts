export type NotificationChannel = 'email' | 'whatsapp' | 'internal'
export type NotificationStatus = 'pending' | 'sent' | 'partial' | 'failed'

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
