import { authRequest, type DashboardWidgetKey } from '@/composables/useApi'
import type { DashboardConfigResponse, DashboardStats } from './types'

export function fetchDashboardConfig(): Promise<DashboardConfigResponse> {
  return authRequest<DashboardConfigResponse>('/api/dashboard')
}

export function updateDashboardConfig(
  widgets: DashboardWidgetKey[],
): Promise<DashboardConfigResponse> {
  return authRequest<DashboardConfigResponse>('/api/dashboard', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ widgets }),
  })
}

export function fetchDashboardStats(): Promise<DashboardStats> {
  return authRequest<DashboardStats>('/api/dashboard/stats')
}
