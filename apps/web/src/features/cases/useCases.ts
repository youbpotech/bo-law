import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { createCase, fetchCases, updateCase, updateInvoice } from './api'

export function useCases() {
  const queryClient = useQueryClient()
  const casesQuery = useQuery({ queryKey: ['cases'], queryFn: fetchCases })

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['cases'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications', 'internal'] }),
    ])
  }

  const createMutation = useMutation({ mutationFn: createCase, onSuccess: invalidate })
  const updateMutation = useMutation({ mutationFn: updateCase, onSuccess: invalidate })
  const invoiceMutation = useMutation({ mutationFn: updateInvoice, onSuccess: invalidate })

  return {
    cases: computed(() => casesQuery.data.value ?? []),
    isLoading: casesQuery.isLoading,
    error: casesQuery.error,
    createCase: createMutation.mutateAsync,
    updateCase: updateMutation.mutateAsync,
    updateInvoice: invoiceMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: computed(() => updateMutation.isPending.value || invoiceMutation.isPending.value),
    refresh: casesQuery.refetch,
  }
}
