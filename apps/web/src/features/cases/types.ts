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
  title: string
  serviceType: string
  description: string | null
  contractedFee: string | number
  stage: LegalCaseStage
  documentsComplete: boolean
  contractSignedAt: string
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  client?: Client | null
  lead?: Lead | null
  invoices?: Invoice[]
}

export interface CreateCaseInput {
  leadId?: string | null
  clientId: string
  title: string
  serviceType: string
  description?: string | null
  contractedFee: string
  contractSignedAt?: string | null
  dueAt?: string | null
}

export type UpdateCaseInput = Partial<
  Pick<LegalCase, 'title' | 'serviceType' | 'description' | 'stage' | 'documentsComplete'>
>

export interface UpdateInvoiceInput {
  status: InvoiceStatus
}
