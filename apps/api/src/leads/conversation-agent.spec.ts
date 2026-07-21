import { describe, expect, it } from 'vitest'
import { Lead } from '../entities/Lead'
import { LeadMessage } from '../entities/LeadMessage'
import {
  buildAgentContext,
  buildFeeBudgetClarificationReply,
  buildMeetingRequestWithPreferenceReply,
  buildMeetingTransitionFallback,
  buildMissingPreferenceReply,
  buildQualificationFallback,
  isReadyForMeeting,
  messageRequestsGuidance,
  missingQualificationFields,
  readConversationProfile,
  selectMeetingFacts,
  selectNextQualificationField,
  withFirstContactIntroduction,
  WELCOME_MESSAGE,
} from './conversation-agent'

function makeLead(input: Partial<Lead> = {}) {
  return {
    id: 'lead-1',
    companyId: 1,
    clientId: null,
    phone: '+351900000000',
    email: null,
    name: null,
    sourceChannel: 'other',
    legalArea: null,
    serviceType: null,
    caseSummary: null,
    jurisdiction: null,
    urgency: null,
    deadline: null,
    feeBudget: null,
    paymentCapacity: null,
    documentReadiness: null,
    requestedHumanHelp: false,
    qualificationScore: 0,
    qualificationLevel: 'frio',
    conversationStatus: 'bot_active',
    salesStage: 'new',
    interviewAt: null,
    rehydrateAt: null,
    lastMessage: null,
    lastMessageAt: null,
    profile: {},
    ...input,
  } as Lead
}

function makeMessage(content: string, senderType: 'lead' | 'bot' = 'lead') {
  return { senderType, content } as LeadMessage
}

const qualifiedLead = makeLead({
  name: 'Leonardo',
  legalArea: 'Direito do Trabalho',
  serviceType: 'Questão laboral',
  caseSummary: 'Recebi uma comunicação de despedimento.',
  jurisdiction: 'Portugal',
  urgency: 'high',
  deadline: 'dia 25/07',
  documentReadiness: 'partial',
  feeBudget: 1_500,
  paymentCapacity: 'Necessita parcelamento',
})

describe('legal lead qualification', () => {
  it('uses a neutral law-office welcome without the real-estate brand', () => {
    expect(WELCOME_MESSAGE).toContain('assistente virtual do escritório')
    expect(WELCOME_MESSAGE).not.toContain('Vou Mudar Para Portugal')
  })

  it('selects legal qualification fields in order, including the critical deadline', () => {
    const lead = makeLead({ name: 'Ana', legalArea: 'Direito Civil' })
    expect(selectNextQualificationField(lead, [])).toBe('serviceType')
    expect(missingQualificationFields(lead)).toContain('deadline')
    expect(missingQualificationFields(lead)).not.toContain('phone')
  })

  it('keeps guidance on the current missing topic until it is answered', () => {
    const lead = makeLead({ name: 'Ana' })
    expect(
      selectNextQualificationField(
        lead,
        ['name', 'legalArea'],
        'Não sei classificar, pode me ajudar?',
      ),
    ).toBe('legalArea')
    expect(
      selectNextQualificationField(
        lead,
        ['name', 'legalArea'],
        'É um problema no trabalho',
        'legalArea',
      ),
    ).toBe('legalArea')
    expect(messageRequestsGuidance('Pode me orientar?')).toBe(true)
  })

  it('only offers an interview after every required field and phone are present', () => {
    expect(isReadyForMeeting(qualifiedLead)).toBe(true)
    expect(isReadyForMeeting({ ...qualifiedLead, deadline: null })).toBe(false)
    expect(isReadyForMeeting({ ...qualifiedLead, phone: '' })).toBe(false)
  })

  it('provides safe deterministic guidance without giving legal advice', () => {
    const reply = buildQualificationFallback('urgency', makeLead(), true)
    expect(reply).toContain('profissional')
    expect(reply).toContain('data')
    expect(reply).not.toMatch(/causa ganha|você tem direito/i)
  })

  it('builds a context with legal intake data and without internal ids', () => {
    const context = buildAgentContext(
      qualifiedLead,
      [makeMessage('Preciso de ajuda com um prazo')],
      null,
    )
    const serialized = JSON.stringify(context)
    expect(context.knownProfile.legalArea).toBe('Direito do Trabalho')
    expect(context.knownProfile.deadline).toBe('dia 25/07')
    expect(serialized).not.toContain('lead-1')
    expect(serialized).not.toContain('qualificationScore')
  })

  it('clarifies an ambiguous fee amount without inventing a proposal', () => {
    const reply = buildFeeBudgetClarificationReply(null)
    expect(reply).toContain('honorários')
    expect(reply).toContain('proposta do escritório')
  })

  it('adds the welcome once before a contextual fallback', () => {
    const reply = withFirstContactIntroduction(
      buildQualificationFallback('legalArea', makeLead({ name: 'Ana' })),
    )
    expect(reply).toContain(WELCOME_MESSAGE)
    expect(reply.match(/\?/g)).toHaveLength(1)
  })
})

describe('legal interview transition', () => {
  it('selects at most four formatted legal facts', () => {
    const facts = selectMeetingFacts(qualifiedLead)
    expect(facts).toHaveLength(4)
    expect(facts.map((fact) => fact.key)).toEqual([
      'legalArea',
      'serviceType',
      'jurisdiction',
      'urgency',
    ])
    expect(facts.every((fact) => fact.formattedValue.startsWith('*'))).toBe(true)
  })

  it('creates a deterministic recap with one scheduling question', () => {
    const reply = buildMeetingTransitionFallback(qualifiedLead)
    expect(reply).toContain('Leonardo,')
    expect(reply).toContain('*Direito do Trabalho*')
    expect(reply).toContain('profissional do escritório')
    expect(reply.match(/\?/g)).toHaveLength(1)
  })

  it('asks only for a missing interview preference and does not repeat a complete request', () => {
    expect(buildMissingPreferenceReply(null, null)).toBe(
      'Qual dia e horário funcionam melhor para a entrevista?',
    )
    expect(buildMissingPreferenceReply('terça-feira', null)).toContain('qual horário')
    const reply = buildMeetingRequestWithPreferenceReply(qualifiedLead, 'terça-feira', '15h')
    expect(reply).toContain('*terça-feira*')
    expect(reply).toContain('*15h*')
    expect(reply).not.toContain('?')
  })

  it('reads only valid, durable legal conversation fields', () => {
    const profile = readConversationProfile(
      makeLead({
        profile: {
          meetingStage: 'collecting_preference',
          preferredDay: 'terça-feira',
          askedProfileFields: ['feeBudget', 'internalField'],
          activeGuidanceField: 'internalField',
          profileRecapSent: true,
          pendingFeeBudgetConfirmation: 1500,
        },
      }),
    )
    expect(profile).toEqual({
      meetingStage: 'collecting_preference',
      preferredDay: 'terça-feira',
      preferredTime: null,
      meetingPreferenceRaw: null,
      askedProfileFields: ['feeBudget'],
      activeGuidanceField: null,
      profileRecapSent: true,
      pendingFeeBudgetConfirmation: 1500,
    })
  })
})
