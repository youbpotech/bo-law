import { describe, expect, it } from 'vitest'
import {
  calculateInvoiceAmount,
  canTransitionCaseStage,
  canTransitionInvoiceStatus,
  stageAfterPaidInvoice,
} from './workflow'

describe('legal case workflow', () => {
  it('keeps the incomplete-document loop explicit', () => {
    expect(canTransitionCaseStage('diligences', 'awaiting_documents')).toBe(true)
    expect(canTransitionCaseStage('awaiting_documents', 'document_collection')).toBe(true)
    expect(canTransitionCaseStage('awaiting_documents', 'final_artifacts')).toBe(false)
  })

  it('does not bypass payment gates', () => {
    expect(canTransitionCaseStage('awaiting_initial_payment', 'document_collection')).toBe(false)
    expect(canTransitionCaseStage('awaiting_final_payment', 'closed')).toBe(false)
    expect(stageAfterPaidInvoice('partial')).toBe('document_collection')
    expect(stageAfterPaidInvoice('final')).toBe('closed')
  })

  it('requires invoice states to advance one step at a time', () => {
    expect(canTransitionInvoiceStatus('requested', 'issued')).toBe(true)
    expect(canTransitionInvoiceStatus('requested', 'paid')).toBe(false)
    expect(canTransitionInvoiceStatus('paid', 'issued')).toBe(false)
  })

  it('splits the contracted fee into 30 and 70 percent amounts', () => {
    expect(calculateInvoiceAmount(1_000, 'partial')).toBe(300)
    expect(calculateInvoiceAmount(1_000, 'final')).toBe(700)
    expect(calculateInvoiceAmount(999.99, 'partial')).toBe(300)
    expect(
      calculateInvoiceAmount(100.05, 'partial') + calculateInvoiceAmount(100.05, 'final'),
    ).toBe(100.05)
  })
})
