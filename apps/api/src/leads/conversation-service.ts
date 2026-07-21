import { extractFeeBudgetInterpretation, extractLeadProfile } from './ai-service'
import {
  buildAgentContext,
  buildFeeBudgetClarificationReply,
  buildMeetingPreferenceReply,
  buildMeetingRequestWithPreferenceReply,
  buildMeetingTransitionFallback,
  buildMissingPreferenceReply,
  buildQualificationFallback,
  HUMAN_HANDOFF_REPLY,
  isReadyForMeeting,
  messageRequestsGuidance,
  MEETING_DECLINED_REPLY,
  missingQualificationFields,
  readConversationProfile,
  selectNextQualificationField,
  withFirstContactIntroduction,
} from './conversation-agent'
import { leadConfig } from './config'
import {
  applyProfilePatch,
  getLeadByIdForProcessing,
  setLeadConversationStatus,
  updateLastMessage,
  updateLeadConversationProfile,
} from './lead-service'
import {
  claimMessageForBot,
  createBotReplyIdempotently,
  isFirstInboundMessage,
  listMessagesForLead,
  markMessageBotProcessed,
  releaseMessageBotClaim,
  updateMessageTwilioSid,
} from './message-service'
import { sendWhatsappMessage } from './twilio-service'

async function createReply(
  messageId: string,
  leadId: string,
  content: string,
  whatsappFrom?: string,
) {
  const outbound = await createBotReplyIdempotently(leadId, messageId, content)
  await updateLastMessage(leadId, outbound.content)
  if (!outbound.twilioMessageSid) {
    const lead = await getLeadByIdForProcessing(leadId)
    if (!lead) throw new Error('Lead não encontrado antes do envio da resposta')
    const sent = await sendWhatsappMessage(lead.phone, outbound.content, whatsappFrom)
    await updateMessageTwilioSid(outbound.id, sent.sid)
  }
}

export async function processInboundMessage(messageId: string, whatsappFrom?: string) {
  const message = await claimMessageForBot(messageId, leadConfig.audioLeaseMs)
  if (!message) return
  try {
    if (
      message.id !== messageId ||
      message.direction !== 'inbound' ||
      message.senderType !== 'lead'
    ) {
      await releaseMessageBotClaim(messageId)
      return
    }
    const lead = await getLeadByIdForProcessing(message.leadId)
    if (!lead) return
    if (lead.conversationStatus !== 'bot_active') {
      await markMessageBotProcessed(message.id)
      return
    }

    const messages = await listMessagesForLead(lead.id, 10)
    const storedConversation = readConversationProfile(lead)
    const patch = await extractLeadProfile(lead, messages, message.content)
    const feeBudgetInterpretation = extractFeeBudgetInterpretation(message.content)
    const affirmative =
      /^(?:sim|isso|exato|exatamente|correto|isso mesmo|sim,? exatamente)[.!]?$/i.test(
        message.content.trim(),
      )
    const negative = /^(?:n[ãa]o|negativo|n[ãa]o,? quis dizer outra coisa)[.!]?$/i.test(
      message.content.trim(),
    )
    let pendingFeeBudgetConfirmation = storedConversation.pendingFeeBudgetConfirmation
    let feeBudgetClarification: number | null | undefined

    if (feeBudgetInterpretation.kind === 'confirmed') {
      patch.feeBudget = feeBudgetInterpretation.value
      patch.clearFeeBudget = false
      pendingFeeBudgetConfirmation = null
    } else if (feeBudgetInterpretation.kind === 'ambiguous') {
      patch.feeBudget = null
      patch.clearFeeBudget = true
      pendingFeeBudgetConfirmation = feeBudgetInterpretation.suggestedValue
      feeBudgetClarification = feeBudgetInterpretation.suggestedValue
    } else if (pendingFeeBudgetConfirmation && affirmative) {
      patch.feeBudget = pendingFeeBudgetConfirmation
      pendingFeeBudgetConfirmation = null
    } else if (pendingFeeBudgetConfirmation && negative) {
      patch.feeBudget = null
      patch.clearFeeBudget = true
      pendingFeeBudgetConfirmation = null
      feeBudgetClarification = null
    }

    await applyProfilePatch(lead, patch)
    let currentLead = await getLeadByIdForProcessing(lead.id)
    if (!currentLead || currentLead.conversationStatus === 'human_active') {
      await markMessageBotProcessed(message.id)
      return
    }

    const isFirstMessage = await isFirstInboundMessage(message.id, lead.id)
    let conversation = {
      ...storedConversation,
      pendingFeeBudgetConfirmation,
      preferredDay: patch.preferredDay ?? storedConversation.preferredDay,
      preferredTime: patch.preferredTime ?? storedConversation.preferredTime,
      meetingPreferenceRaw:
        patch.preferredDay || patch.preferredTime
          ? message.content
          : storedConversation.meetingPreferenceRaw,
    }

    let reply: string
    let statusAfterReply: 'awaiting_human' | null = null
    const readyForMeeting = isReadyForMeeting(currentLead)
    const reopeningMeeting =
      readyForMeeting &&
      conversation.meetingStage === 'declined' &&
      (patch.meetingDecision === 'accepted' || patch.requestedHumanHelp)

    if (currentLead.requestedHumanHelp || currentLead.urgency === 'high') {
      currentLead = await updateLeadConversationProfile(currentLead, conversation, 'bot_active')
      reply = HUMAN_HANDOFF_REPLY
      statusAfterReply = 'awaiting_human'
    } else if (feeBudgetClarification !== undefined) {
      currentLead = await updateLeadConversationProfile(currentLead, conversation, 'bot_active')
      reply = buildFeeBudgetClarificationReply(feeBudgetClarification)
    } else if (
      conversation.meetingStage === 'requested' &&
      conversation.preferredDay &&
      conversation.preferredTime
    ) {
      reply = buildMeetingPreferenceReply(
        currentLead,
        conversation.preferredDay,
        conversation.preferredTime,
      )
      statusAfterReply = 'awaiting_human'
    } else if (conversation.meetingStage === 'collecting_preference') {
      if (patch.meetingDecision === 'declined') {
        conversation = {
          ...conversation,
          meetingStage: 'declined',
          preferredDay: null,
          preferredTime: null,
          meetingPreferenceRaw: null,
        }
        currentLead = await updateLeadConversationProfile(currentLead, conversation)
        reply = MEETING_DECLINED_REPLY
      } else if (conversation.preferredDay && conversation.preferredTime) {
        const preferredDay = conversation.preferredDay
        const preferredTime = conversation.preferredTime
        conversation = {
          ...conversation,
          meetingStage: 'requested',
          meetingPreferenceRaw: message.content,
        }
        currentLead = await updateLeadConversationProfile(currentLead, conversation, 'bot_active')
        statusAfterReply = 'awaiting_human'
        reply = buildMeetingPreferenceReply(currentLead, preferredDay, preferredTime)
      } else {
        currentLead = await updateLeadConversationProfile(currentLead, conversation)
        reply = buildMissingPreferenceReply(conversation.preferredDay, conversation.preferredTime)
      }
    } else if (
      reopeningMeeting ||
      (conversation.meetingStage === 'not_offered' && readyForMeeting)
    ) {
      const preferredDay = conversation.preferredDay
      const preferredTime = conversation.preferredTime
      if (preferredDay && preferredTime) {
        const hadSentRecap = conversation.profileRecapSent
        conversation = {
          ...conversation,
          meetingStage: 'requested',
          meetingPreferenceRaw: message.content,
          profileRecapSent: true,
        }
        currentLead = await updateLeadConversationProfile(currentLead, conversation, 'bot_active')
        statusAfterReply = 'awaiting_human'
        reply = hadSentRecap
          ? buildMeetingPreferenceReply(currentLead, preferredDay, preferredTime)
          : buildMeetingRequestWithPreferenceReply(currentLead, preferredDay, preferredTime)
      } else if (conversation.profileRecapSent) {
        conversation = { ...conversation, meetingStage: 'collecting_preference' }
        currentLead = await updateLeadConversationProfile(currentLead, conversation, 'bot_active')
        reply = buildMissingPreferenceReply(preferredDay, preferredTime)
      } else {
        conversation = {
          ...conversation,
          meetingStage: 'collecting_preference',
          profileRecapSent: true,
        }
        currentLead = await updateLeadConversationProfile(currentLead, conversation, 'bot_active')
        reply = buildMeetingTransitionFallback(currentLead)
      }
    } else {
      if (
        conversation.activeGuidanceField &&
        !missingQualificationFields(currentLead).includes(conversation.activeGuidanceField)
      ) {
        conversation = { ...conversation, activeGuidanceField: null }
      }
      const nextField = selectNextQualificationField(
        currentLead,
        conversation.askedProfileFields,
        message.content,
        conversation.activeGuidanceField,
      )
      const requestedGuidanceForCurrentField = Boolean(
        nextField &&
          messageRequestsGuidance(message.content) &&
          conversation.askedProfileFields.includes(nextField),
      )
      if (requestedGuidanceForCurrentField) {
        conversation = { ...conversation, activeGuidanceField: nextField }
      }
      if (nextField && !conversation.askedProfileFields.includes(nextField)) {
        conversation = {
          ...conversation,
          askedProfileFields: [...conversation.askedProfileFields, nextField],
        }
      }
      currentLead = await updateLeadConversationProfile(currentLead, conversation, 'bot_active')
      const context = buildAgentContext(currentLead, messages, nextField, isFirstMessage)
      reply = buildQualificationFallback(nextField, currentLead, context.customerNeedsGuidance)
    }

    if (isFirstMessage) reply = withFirstContactIntroduction(reply)

    await createReply(message.id, currentLead.id, reply, whatsappFrom)
    if (statusAfterReply) {
      await setLeadConversationStatus(currentLead.companyId, currentLead.id, statusAfterReply)
    }
    await markMessageBotProcessed(message.id)
  } catch (error) {
    await releaseMessageBotClaim(messageId)
    throw error
  }
}
