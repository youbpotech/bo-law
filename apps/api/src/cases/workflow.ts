import { InvoiceKind, InvoiceStatus } from '../entities/Invoice'
import { LegalCaseStage } from '../entities/LegalCase'

export const CASE_STAGES: LegalCaseStage[] = [
  'awaiting_initial_payment',
  'document_collection',
  'public_services_scheduling',
  'diligences',
  'awaiting_documents',
  'final_artifacts',
  'client_final_delivery',
  'awaiting_final_payment',
  'closed',
]

export const INVOICE_STATUSES: InvoiceStatus[] = ['requested', 'issued', 'paid']

export const ALLOWED_STAGE_TRANSITIONS: Record<LegalCaseStage, LegalCaseStage[]> = {
  awaiting_initial_payment: [],
  document_collection: ['public_services_scheduling'],
  public_services_scheduling: ['diligences'],
  diligences: ['awaiting_documents', 'final_artifacts'],
  awaiting_documents: ['document_collection'],
  final_artifacts: ['client_final_delivery'],
  client_final_delivery: ['awaiting_final_payment'],
  awaiting_final_payment: [],
  closed: [],
}

export function canTransitionCaseStage(current: LegalCaseStage, next: LegalCaseStage): boolean {
  return current === next || ALLOWED_STAGE_TRANSITIONS[current].includes(next)
}

export function canTransitionInvoiceStatus(current: InvoiceStatus, next: InvoiceStatus): boolean {
  const currentIndex = INVOICE_STATUSES.indexOf(current)
  const nextIndex = INVOICE_STATUSES.indexOf(next)
  return nextIndex === currentIndex || nextIndex === currentIndex + 1
}

export function calculateInvoiceAmount(contractedFee: number, kind: InvoiceKind): number {
  const totalCents = Math.round(contractedFee * 100)
  const partialCents = Math.round(totalCents * 0.3)
  return (kind === 'partial' ? partialCents : totalCents - partialCents) / 100
}

export function stageAfterPaidInvoice(kind: InvoiceKind): LegalCaseStage {
  return kind === 'partial' ? 'document_collection' : 'closed'
}
