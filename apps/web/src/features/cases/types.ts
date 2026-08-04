import type { Client } from '@/composables/useApi'
import type { Lead } from '@/features/leads/types'

export type LegalCaseStage =
  | 'awaiting_initial_payment'
  | 'document_collection'
  | 'public_services_scheduling'
  | 'diligences'
  | 'awaiting_documents'
  | 'final_artifacts'
  | 'client_final_delivery'
  | 'awaiting_final_payment'
  | 'closed'

export type InvoiceKind = 'partial' | 'final'
export type InvoiceStatus = 'requested' | 'issued' | 'paid'

export interface Invoice {
  id: string
  legalCaseId: string
  kind: InvoiceKind
  status: InvoiceStatus
  percentage: number
  amount: string | number
  dueAt: string | null
  issuedAt: string | null
  paidAt: string | null
  createdAt: string
  updatedAt: string
}

export interface LegalCase {
  id: string
  companyId: number
  leadId: string | null
  clientId: string
  createdByUserId: string
  caseType: 'general' | 'niss' | 'aima'
  integrationStatus: 'not_applicable' | 'pending' | 'active' | 'failed' | 'completed'
  title: string
  serviceId: string
  service?: { id: string; name: string; processType: 'general' | 'niss' | 'aima'; active: boolean }
  description: string | null
  contractedFee: string | number | null
  stage: LegalCaseStage
  documentsComplete: boolean
  contractSignedAt: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  client?: Client | null
  lead?: Lead | null
  invoices?: Invoice[]
  createdByUser?: Pick<import('@/composables/useApi').User, 'id' | 'name'> | null
  stakeholders?: Array<{
    legalCaseId: string
    userId: string
    role: 'creator' | 'stakeholder'
    user: Pick<import('@/composables/useApi').User, 'id' | 'name'>
  }>
  integrations?: Array<{
    id: string
    provider: 'botniss' | 'botaima'
    externalProcessId: string | null
    externalReference: string
    status: 'pending' | 'processing' | 'active' | 'failed' | 'completed'
  }>
}

export interface CreateCaseInput {
  leadId?: string | null
  clientId: string
  title: string
  serviceId: string
  description?: string | null
  contractedFee: string
  contractSignedAt?: string | null
  dueAt?: string | null
  stakeholderUserIds: string[]
}

export type UpdateCaseInput = Partial<
  Pick<LegalCase, 'title' | 'description' | 'stage' | 'documentsComplete'>
> & {
  serviceId?: string
  stakeholderUserIds?: string[]
}

export interface UpdateInvoiceInput {
  status: InvoiceStatus
}
