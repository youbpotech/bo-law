import { computed } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  acknowledgeInternalNotification,
  fetchInternalNotifications,
} from './api'
import type { InternalNotification } from './types'

const NOTIFICATIONS_QUERY_KEY = ['notifications', 'internal'] as const

export function useNotifications() {
  const queryClient = useQueryClient()
  const notificationsQuery = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: fetchInternalNotifications,
    refetchInterval: 30_000,
  })
  const acknowledgeMutation = useMutation({
    mutationFn: acknowledgeInternalNotification,
    onSuccess: async (_, id) => {
      queryClient.setQueryData<InternalNotification[]>(
        NOTIFICATIONS_QUERY_KEY,
        (notifications = []) =>
          notifications.map((notification) =>
            notification.id === id
              ? { ...notification, readAt: new Date().toISOString() }
              : notification,
          ),
      )
      await queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY })
    },
  })

  const notifications = computed(() => notificationsQuery.data.value ?? [])
  const unreadCount = computed(
    () => notifications.value.filter((notification) => !notification.readAt).length,
  )

  return {
    notifications,
    unreadCount,
    isLoading: notificationsQuery.isLoading,
    error: notificationsQuery.error,
    refetch: notificationsQuery.refetch,
    acknowledge: acknowledgeMutation.mutateAsync,
    acknowledgingId: computed(() =>
      acknowledgeMutation.isPending.value ? acknowledgeMutation.variables.value : null,
    ),
  }
}
