import { computed, ref } from 'vue'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  assumeLead,
  convertLead,
  createLead,
  fetchLeadDetail,
  fetchLeads,
  sendManualMessage,
  updateLead,
} from './api'
import type { ConvertLeadInput, CreateLeadInput, LeadQualificationInput } from './types'

export function useLeads() {
  const queryClient = useQueryClient()
  const search = ref('')
  const conversationStatus = ref('')
  const qualificationLevel = ref('')
  const salesStage = ref('')
  const page = ref(1)
  const selectedLeadId = ref<string | null>(null)

  const params = computed(() => {
    const value = new URLSearchParams({ page: String(page.value), limit: '25' })
    if (search.value.trim()) value.set('search', search.value.trim())
    if (conversationStatus.value) value.set('conversationStatus', conversationStatus.value)
    if (qualificationLevel.value) value.set('qualificationLevel', qualificationLevel.value)
    if (salesStage.value) value.set('salesStage', salesStage.value)
    return value
  })

  const listQuery = useQuery({
    queryKey: computed(() => ['leads', params.value.toString()]),
    queryFn: () => fetchLeads(params.value),
    placeholderData: keepPreviousData,
    refetchInterval: 8_000,
  })

  const detailQuery = useQuery({
    queryKey: computed(() => ['lead', selectedLeadId.value]),
    queryFn: ({ signal }) => fetchLeadDetail(selectedLeadId.value!, signal),
    enabled: computed(() => Boolean(selectedLeadId.value)),
    refetchInterval: 8_000,
  })

  const createMutation = useMutation({
    mutationFn: (input: CreateLeadInput) => createLead(input),
    onSuccess: (lead) => {
      selectedLeadId.value = lead.id
      refresh()
    },
  })
  const updateMutation = useMutation({
    mutationFn: (input: LeadQualificationInput) => updateLead(selectedLeadId.value!, input),
    onSuccess: () => refresh(),
  })
  const assumeMutation = useMutation({
    mutationFn: () => assumeLead(selectedLeadId.value!),
    onSuccess: () => refresh(),
  })
  const messageMutation = useMutation({
    mutationFn: (content: string) => sendManualMessage(selectedLeadId.value!, content),
    onSuccess: () => refresh(),
  })
  const convertMutation = useMutation({
    mutationFn: (input: ConvertLeadInput) => convertLead(selectedLeadId.value!, input),
    onSuccess: async () => {
      refresh()
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['cases'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications', 'internal'] }),
      ])
    },
  })

  function selectLead(id: string) {
    selectedLeadId.value = id
  }

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['leads'] })
    if (selectedLeadId.value)
      void queryClient.invalidateQueries({ queryKey: ['lead', selectedLeadId.value] })
  }

  function resetPage() {
    page.value = 1
  }

  return {
    search,
    conversationStatus,
    qualificationLevel,
    salesStage,
    page,
    selectedLeadId,
    list: computed(() => listQuery.data.value),
    detail: computed(() => detailQuery.data.value ?? null),
    isLoading: listQuery.isLoading,
    isFetching: listQuery.isFetching,
    error: computed(() => listQuery.error.value ?? detailQuery.error.value),
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isAssuming: assumeMutation.isPending,
    isSending: messageMutation.isPending,
    isConverting: convertMutation.isPending,
    selectLead,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    assume: assumeMutation.mutateAsync,
    sendMessage: messageMutation.mutateAsync,
    convert: convertMutation.mutateAsync,
    refresh,
    resetPage,
  }
}
