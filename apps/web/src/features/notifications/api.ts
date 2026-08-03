import { authRequest } from '@/composables/useApi'
import type { InternalNotification } from './types'

export function fetchInternalNotifications(): Promise<InternalNotification[]> {
  return authRequest<InternalNotification[]>('/api/notifications')
}

export function acknowledgeInternalNotification(id: string): Promise<void> {
  return authRequest<void>(`/api/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
  })
}
