import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import type { DashboardWidgetKey } from '@/composables/useApi'
import { fetchDashboardConfig, fetchDashboardStats, updateDashboardConfig } from './api'

export const DEFAULT_DASHBOARD_WIDGETS: DashboardWidgetKey[] = [
  'totalLeads',
  'hotLeads',
  'pendingInterviews',
  'activeCases',
  'pendingDocuments',
  'outstandingAmount',
]

export function useDashboard() {
  const queryClient = useQueryClient()
  const configQuery = useQuery({
    queryKey: ['dashboard', 'config'],
    queryFn: fetchDashboardConfig,
  })
  const statsQuery = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: fetchDashboardStats,
  })
  const updateMutation = useMutation({
    mutationFn: updateDashboardConfig,
    onSuccess: (config) => {
      queryClient.setQueryData(['dashboard', 'config'], config)
      void queryClient.invalidateQueries({ queryKey: ['session'] })
    },
  })

  return {
    widgets: computed(() => configQuery.data.value?.widgets ?? DEFAULT_DASHBOARD_WIDGETS),
    stats: computed(() => statsQuery.data.value),
    isLoading: computed(() => configQuery.isLoading.value || statsQuery.isLoading.value),
    error: computed(() => configQuery.error.value ?? statsQuery.error.value),
    saveWidgets: updateMutation.mutateAsync,
    isSaving: updateMutation.isPending,
    refresh: () => Promise.all([configQuery.refetch(), statsQuery.refetch()]),
  }
}
