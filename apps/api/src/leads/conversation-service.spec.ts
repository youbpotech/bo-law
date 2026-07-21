import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Lead } from '../entities/Lead'
import { LeadMessage } from '../entities/LeadMessage'
import { LeadProfilePatch } from './types'

const mocks = vi.hoisted(() => ({
  extractFeeBudgetInterpretation: vi.fn(),
  extractLeadProfile: vi.fn(),
  applyProfilePatch: vi.fn(),
  getLeadByIdForProcessing: vi.fn(),
  setLeadConversationStatus: vi.fn(),
  updateLastMessage: vi.fn(),
  updateLeadConversationProfile: vi.fn(),
  claimMessageForBot: vi.fn(),
  createBotReplyIdempotently: vi.fn(),
  isFirstInboundMessage: vi.fn(),
  listMessagesForLead: vi.fn(),
  markMessageBotProcessed: vi.fn(),
  releaseMessageBotClaim: vi.fn(),
  updateMessageTwilioSid: vi.fn(),
  sendWhatsappMessage: vi.fn(),
}))

vi.mock('./config', () => ({ leadConfig: { audioLeaseMs: 60_000 } }))
vi.mock('./ai-service', () => ({
  extractFeeBudgetInterpretation: mocks.extractFeeBudgetInterpretation,
  extractLeadProfile: mocks.extractLeadProfile,
}))
vi.mock('./lead-service', () => ({
  applyProfilePatch: mocks.applyProfilePatch,
  getLeadByIdForProcessing: mocks.getLeadByIdForProcessing,
  setLeadConversationStatus: mocks.setLeadConversationStatus,
  updateLastMessage: mocks.updateLastMessage,
  updateLeadConversationProfile: mocks.updateLeadConversationProfile,
}))
vi.mock('./message-service', () => ({
  claimMessageForBot: mocks.claimMessageForBot,
  createBotReplyIdempotently: mocks.createBotReplyIdempotently,
  isFirstInboundMessage: mocks.isFirstInboundMessage,
  listMessagesForLead: mocks.listMessagesForLead,
  markMessageBotProcessed: mocks.markMessageBotProcessed,
  releaseMessageBotClaim: mocks.releaseMessageBotClaim,
  updateMessageTwilioSid: mocks.updateMessageTwilioSid,
}))
vi.mock('./twilio-service', () => ({ sendWhatsappMessage: mocks.sendWhatsappMessage }))

import { HUMAN_HANDOFF_REPLY, WELCOME_MESSAGE } from './conversation-agent'
import { processInboundMessage } from './conversation-service'

const emptyPatch: LeadProfilePatch = {
  name: null,
  email: null,
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
  meetingDecision: null,
  preferredDay: null,
  preferredTime: null,
  summary: null,
}

function makeLead(input: Partial<Lead> = {}) {
  return {
    id: 'lead-1',
    companyId: 7,
    clientId: null,
    phone: '+351900000000',
    name: null,
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
    conversationStatus: 'bot_active',
    salesStage: 'new',
    profile: {},
    ...input,
  } as Lead
}

function makeMessage(content: string) {
  return {
    id: 'message-1',
    leadId: 'lead-1',
    direction: 'inbound',
    senderType: 'lead',
    processingStatus: 'ready',
    content,
  } as LeadMessage
}

beforeEach(() => {
  vi.clearAllMocks()
  const lead = makeLead()
  const message = makeMessage('Preciso de ajuda com uma questão laboral')
  mocks.claimMessageForBot.mockResolvedValue(message)
  mocks.getLeadByIdForProcessing.mockResolvedValue(lead)
  mocks.listMessagesForLead.mockResolvedValue([message])
  mocks.extractLeadProfile.mockResolvedValue(emptyPatch)
  mocks.extractFeeBudgetInterpretation.mockReturnValue({ kind: 'none' })
  mocks.applyProfilePatch.mockResolvedValue(lead)
  mocks.updateLeadConversationProfile.mockImplementation(
    async (
      currentLead: Lead,
      profile: Record<string, unknown>,
      conversationStatus = currentLead.conversationStatus,
    ) => ({ ...currentLead, profile, conversationStatus }),
  )
  mocks.createBotReplyIdempotently.mockImplementation(
    async (_leadId: string, _messageId: string, content: string) => ({
      id: 'outbound-1',
      content,
      twilioMessageSid: 'existing-sid',
    }),
  )
  mocks.isFirstInboundMessage.mockResolvedValue(false)
})

describe('legal inbound conversation orchestration', () => {
  it('does not process a conversation already assumed by a human', async () => {
    mocks.getLeadByIdForProcessing.mockResolvedValue(
      makeLead({ conversationStatus: 'human_active' }),
    )

    await processInboundMessage('message-1')

    expect(mocks.extractLeadProfile).not.toHaveBeenCalled()
    expect(mocks.markMessageBotProcessed).toHaveBeenCalledWith('message-1')
  })

  it('stores an ambiguous fee confirmation in the durable conversation profile', async () => {
    mocks.claimMessageForBot.mockResolvedValue(makeMessage('Posso pagar 1m'))
    mocks.extractLeadProfile.mockResolvedValue({ ...emptyPatch, feeBudget: 1 })
    mocks.extractFeeBudgetInterpretation.mockReturnValue({
      kind: 'ambiguous',
      suggestedValue: null,
    })

    await processInboundMessage('message-1')

    expect(mocks.applyProfilePatch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ feeBudget: null }),
    )
    expect(mocks.updateLeadConversationProfile).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ pendingFeeBudgetConfirmation: null }),
      'bot_active',
    )
    expect(mocks.createBotReplyIdempotently).toHaveBeenCalledWith(
      'lead-1',
      'message-1',
      expect.stringContaining('honorários'),
    )
  })

  it('introduces the office assistant without exposing internal qualification data', async () => {
    mocks.isFirstInboundMessage.mockResolvedValue(true)
    await processInboundMessage('message-1')

    expect(mocks.createBotReplyIdempotently).toHaveBeenCalledWith(
      'lead-1',
      'message-1',
      expect.stringContaining(WELCOME_MESSAGE),
    )
  })

  it('moves the tenant-scoped conversation to awaiting human after capturing preference', async () => {
    const lead = makeLead({
      name: 'Ana',
      profile: { meetingStage: 'collecting_preference', profileRecapSent: true },
    })
    mocks.getLeadByIdForProcessing.mockResolvedValue(lead)
    mocks.extractLeadProfile.mockResolvedValue({
      ...emptyPatch,
      preferredDay: 'terça-feira',
      preferredTime: '15h',
    })

    await processInboundMessage('message-1')

    expect(mocks.createBotReplyIdempotently).toHaveBeenCalledWith(
      'lead-1',
      'message-1',
      expect.stringContaining('*terça-feira*'),
    )
    expect(mocks.setLeadConversationStatus).toHaveBeenCalledWith(7, 'lead-1', 'awaiting_human')
    expect(mocks.createBotReplyIdempotently.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.setLeadConversationStatus.mock.invocationCallOrder[0],
    )
  })

  it.each([
    ['explicit request', { requestedHumanHelp: true }],
    ['high urgency', { urgency: 'high' as const }],
  ])(
    'hands off immediately for %s without waiting for full qualification',
    async (_label, patch) => {
      const lead = makeLead(patch)
      mocks.getLeadByIdForProcessing.mockResolvedValue(lead)

      await processInboundMessage('message-1')

      expect(mocks.createBotReplyIdempotently).toHaveBeenCalledWith(
        'lead-1',
        'message-1',
        HUMAN_HANDOFF_REPLY,
      )
      expect(mocks.setLeadConversationStatus).toHaveBeenCalledWith(7, 'lead-1', 'awaiting_human')
    },
  )

  it('accepts an interview refusal without insisting', async () => {
    const lead = makeLead({
      profile: {
        meetingStage: 'collecting_preference',
        preferredDay: 'terça-feira',
        profileRecapSent: true,
      },
    })
    mocks.getLeadByIdForProcessing.mockResolvedValue(lead)
    mocks.extractLeadProfile.mockResolvedValue({
      ...emptyPatch,
      meetingDecision: 'declined',
    })

    await processInboundMessage('message-1')

    expect(mocks.updateLeadConversationProfile).toHaveBeenCalledWith(
      lead,
      expect.objectContaining({
        meetingStage: 'declined',
        preferredDay: null,
        preferredTime: null,
      }),
    )
    expect(mocks.setLeadConversationStatus).not.toHaveBeenCalled()
  })
})
