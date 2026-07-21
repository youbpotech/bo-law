import { getAuthToken } from '@/lib/auth'
import type {
  ConvertLeadInput,
  CreateLeadInput,
  Lead,
  LeadDetail,
  LeadLegalCase,
  LeadQualificationInput,
  LeadsResponse,
} from './types'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${getAuthToken() ?? ''}`,
      ...init?.headers,
    },
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error ?? 'Não foi possível concluir a solicitação')
  }
  return response.json() as Promise<T>
}

export function fetchLeads(params: URLSearchParams) {
  return request<LeadsResponse>(`/api/leads?${params}`)
}

export function createLead(input: CreateLeadInput) {
  return request<Lead>('/api/leads', { method: 'POST', body: JSON.stringify(input) })
}

export function fetchLeadDetail(id: string, signal?: AbortSignal) {
  return request<LeadDetail>(`/api/leads/${id}`, { signal })
}

export function updateLead(id: string, input: LeadQualificationInput) {
  return request<Lead>(`/api/leads/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
}

export function assumeLead(id: string) {
  return request<Lead>(`/api/leads/${id}/assume`, { method: 'POST' })
}

export function sendManualMessage(id: string, content: string) {
  return request<{ deliveryStatus: 'sent' | 'failed'; deliveryError?: string }>(
    `/api/leads/${id}/send-message`,
    { method: 'POST', body: JSON.stringify({ content }) },
  )
}

export function convertLead(id: string, input: ConvertLeadInput) {
  return request<LeadLegalCase>(`/api/leads/${id}/convert`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
