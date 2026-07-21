import { authRequest } from '@/composables/useApi'
import type { CreateCaseInput, LegalCase, UpdateCaseInput, UpdateInvoiceInput } from './types'

type CasesResponse = LegalCase[] | { data: LegalCase[] }

export async function fetchCases(): Promise<LegalCase[]> {
  const response = await authRequest<CasesResponse>('/api/cases')
  return Array.isArray(response) ? response : response.data
}

export function createCase(input: CreateCaseInput): Promise<LegalCase> {
  return authRequest<LegalCase>('/api/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function updateCase({
  id,
  input,
}: {
  id: string
  input: UpdateCaseInput
}): Promise<LegalCase> {
  return authRequest<LegalCase>(`/api/cases/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function updateInvoice({
  caseId,
  invoiceId,
  input,
}: {
  caseId: string
  invoiceId: string
  input: UpdateInvoiceInput
}): Promise<LegalCase> {
  return authRequest<LegalCase>(`/api/cases/${caseId}/invoices/${invoiceId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}
