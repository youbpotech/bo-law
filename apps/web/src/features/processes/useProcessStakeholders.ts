import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { fetchProcessStakeholderCandidates } from './api'

export const PROCESS_STAKEHOLDER_CANDIDATES_QUERY_KEY = [
  'users',
  'process-stakeholder-candidates',
] as const
export function useProcessStakeholders() {
  const candidatesQuery = useQuery({
    queryKey: PROCESS_STAKEHOLDER_CANDIDATES_QUERY_KEY,
    queryFn: fetchProcessStakeholderCandidates,
  })

  return {
    candidates: computed(() => candidatesQuery.data.value ?? []),
    isLoading: candidatesQuery.isLoading,
    error: candidatesQuery.error,
    refetch: candidatesQuery.refetch,
  }
}
