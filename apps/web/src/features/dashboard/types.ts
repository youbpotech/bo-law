import type { DashboardConfig } from '@/composables/useApi'
export interface DashboardStats {
  totalLeads: number
  hotLeads: number
  pendingInterviews: number
  activeCases: number
  pendingDocuments: number
  outstandingAmount: string
  receivedAmount: string
  rehydrationsDue: number
  leadPipeline: Record<string, number>
  casePipeline: Record<string, number>
  recentLeads: Array<{
    id: string
    name: string | null
    phone: string
    salesStage: string
    qualificationLevel: string
    createdAt: string
  }>
  recentCases: Array<{
    id: string
    title: string
    stage: string
    updatedAt: string
    clientName: string
  }>
}

export type DashboardConfigResponse = DashboardConfig
