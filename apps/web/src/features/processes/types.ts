import type { NotificationChannel } from '@/features/notifications/types'

export interface ProcessCreator {
  id: string
  name: string
}

export interface ProcessStakeholderCandidate {
  id: string
  name: string
  notificationChannels: NotificationChannel[]
}
