import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { fetchNotificationChannelCatalog } from './api'

export function useNotificationChannelCatalog() {
  const query = useQuery({
    queryKey: ['notifications', 'channels'],
    queryFn: fetchNotificationChannelCatalog,
  })
  return {
    catalog: computed(() => query.data.value ?? []),
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}
