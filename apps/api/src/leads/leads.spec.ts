import { describe, expect, it } from 'vitest'
import { parseInboundAudio } from './audio-service'
import {
  extractFeeBudgetInterpretation,
  extractMeetingPreference,
  extractPaymentCapacityFallback,
} from './ai-service'
import { leadConfig } from './config'
import {
  calculateQualification,
  isValidSalesStageTransition,
  resolvePatchedFeeBudget,
} from './lead-service'

const accountSid = leadConfig.twilioAccountSid || `AC${'a'.repeat(32)}`
const messageSid = `MM${'b'.repeat(32)}`
const mediaSid = `ME${'c'.repeat(32)}`

describe('legal lead qualification', () => {
  it('classifies a complete, high-intent legal profile as hot', () => {
    expect(
      calculateQualification({
        legalArea: 'Direito do Trabalho',
        serviceType: 'Questão laboral',
        caseSummary: 'Recebi uma comunicação de despedimento.',
        jurisdiction: 'Portugal',
        urgency: 'high',
        deadline: '25/07/2026',
        documentReadiness: 'partial',
        feeBudget: 1_500,
        paymentCapacity: 'Necessita parcelamento',
        requestedHumanHelp: true,
      }),
    ).toEqual({ score: 100, level: 'quente' })
  })

  it('keeps qualification separate from legal merit', () => {
    expect(
      calculateQualification({
        legalArea: 'Direito Civil',
        caseSummary: 'Preciso analisar um contrato.',
      }),
    ).toEqual({ score: 30, level: 'frio' })
  })

  it('clears a previous fee budget after an explicit correction', () => {
    expect(resolvePatchedFeeBudget(2_000, { feeBudget: null, clearFeeBudget: true })).toBeNull()
    expect(resolvePatchedFeeBudget(2_000, { feeBudget: null })).toBe(2_000)
  })

  it('allows only the explicit commercial stage graph and keeps contracted terminal', () => {
    expect(isValidSalesStageTransition('new', 'interview_scheduled')).toBe(true)
    expect(isValidSalesStageTransition('new', 'interview_completed')).toBe(false)
    expect(isValidSalesStageTransition('interview_completed', 'nurturing')).toBe(true)
    expect(isValidSalesStageTransition('lost', 'nurturing')).toBe(true)
    expect(isValidSalesStageTransition('contracted', 'nurturing')).toBe(false)
  })
})

describe('interview preference extraction fallback', () => {
  it('extracts a weekday and time without treating an ordinary preference as acceptance', () => {
    expect(extractMeetingPreference('Pode ser terça às 15:30')).toEqual({
      meetingDecision: null,
      preferredDay: 'terça',
      preferredTime: 'às 15:30',
    })
  })

  it('recognizes explicit interview requests and refusals', () => {
    expect(extractMeetingPreference('Quero agendar uma entrevista').meetingDecision).toBe(
      'accepted',
    )
    expect(extractMeetingPreference('Agora não quero reunião').meetingDecision).toBe('declined')
  })
})

describe('commercial qualification fallbacks', () => {
  it('extracts explicit fee budgets at a law-office scale', () => {
    expect(extractFeeBudgetInterpretation('Posso pagar 1500 euros de honorários')).toEqual({
      kind: 'confirmed',
      value: 1_500,
    })
    expect(extractFeeBudgetInterpretation('Meu orçamento de honorários é 2 mil')).toEqual({
      kind: 'confirmed',
      value: 2_000,
    })
  })

  it('asks for clarification of an ambiguous abbreviation and ignores unrelated dates', () => {
    expect(extractFeeBudgetInterpretation('Posso pagar 1m')).toEqual({
      kind: 'ambiguous',
      suggestedValue: null,
    })
    expect(extractFeeBudgetInterpretation('Minha audiência é dia 25/07')).toEqual({ kind: 'none' })
  })

  it.each([
    ['Consigo fazer o pagamento integral', 'Pagamento integral'],
    ['Vou precisar parcelar os honorários', 'Necessita parcelamento'],
    ['Depende do valor da proposta', 'A avaliar após proposta'],
  ])('extracts payment capacity from %s', (message, expected) => {
    expect(extractPaymentCapacityFallback(message)).toBe(expected)
  })
})

describe('Twilio audio payload', () => {
  it('accepts media hosted by Twilio for the inbound message', () => {
    expect(
      parseInboundAudio({
        NumMedia: '1',
        MessageSid: messageSid,
        MediaContentType0: 'audio/ogg; codecs=opus',
        MediaUrl0: `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${messageSid}/Media/${mediaSid}`,
      }),
    ).toEqual({ contentType: 'audio/ogg', mediaSid })
  })

  it('rejects an external media URL', () => {
    expect(() =>
      parseInboundAudio({
        NumMedia: '1',
        MessageSid: messageSid,
        MediaContentType0: 'audio/ogg',
        MediaUrl0: `https://attacker.example/Accounts/${accountSid}/Messages/${messageSid}/Media/${mediaSid}`,
      }),
    ).toThrow('Identificadores de mídia Twilio inválidos')
  })
})
