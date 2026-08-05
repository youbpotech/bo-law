export type LeadSourceChannel = 'partners' | 'lives' | 'referrals' | 'website' | 'other'
export type LeadUrgency = 'low' | 'medium' | 'high'
export type LeadDocumentReadiness = 'none' | 'partial' | 'complete'
export type LeadQualificationLevel = 'frio' | 'morno' | 'quente'
export type LeadConversationStatus = 'bot_active' | 'awaiting_human' | 'human_active'
export type LeadSalesStage =
  | 'new'
  | 'interview_scheduled'
  | 'interview_completed'
  | 'nurturing'
  | 'contracted'
  | 'lost'

export interface Lead {
  id: string
  companyId: number
  clientId: string | null
  phone: string
  email: string | null
  name: string | null
  sourceChannel: LeadSourceChannel
  legalArea: string | null
  serviceType: string | null
  caseSummary: string | null
  jurisdiction: string | null
  urgency: LeadUrgency | null
  deadline: string | null
  feeBudget: string | number | null
  paymentCapacity: string | null
  documentReadiness: LeadDocumentReadiness | null
  requestedHumanHelp: boolean
  qualificationScore: number
  qualificationLevel: LeadQualificationLevel
  conversationStatus: LeadConversationStatus
  salesStage: LeadSalesStage
  interviewAt: string | null
  rehydrateAt: string | null
  lastMessage: string | null
  lastMessageAt: string | null
  createdAt: string
  updatedAt: string
}

export interface LeadMessage {
  id: string
  direction: 'inbound' | 'outbound'
  senderType: 'lead' | 'bot' | 'human'
  messageType: 'text' | 'audio'
  processingStatus: 'pending' | 'downloading' | 'converting' | 'transcribing' | 'ready' | 'failed'
  content: string
  createdAt: string
  audioProcessing?: {
    transcriptionProvider: string | null
    transcriptionModel: string | null
    language: string | null
    transcribedAt: string | null
  } | null
}

export interface LeadLegalCase {
  id: string
}

export interface LeadDetail {
  lead: Lead
  messages: LeadMessage[]
  legalCase?: LeadLegalCase | null
}

export interface LeadsResponse {
  data: Lead[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
  summary: {
    total: number
    awaitingHuman: number
    byLevel: Record<LeadQualificationLevel, number>
  }
}

export type LeadQualificationInput = Partial<
  Pick<
    Lead,
    | 'clientId'
    | 'phone'
    | 'email'
    | 'name'
    | 'sourceChannel'
    | 'legalArea'
    | 'serviceType'
    | 'caseSummary'
    | 'jurisdiction'
    | 'urgency'
    | 'deadline'
    | 'feeBudget'
    | 'paymentCapacity'
    | 'documentReadiness'
    | 'requestedHumanHelp'
    | 'salesStage'
    | 'interviewAt'
    | 'rehydrateAt'
  >
>

export type CreateLeadInput = Pick<Lead, 'phone' | 'sourceChannel'> & LeadQualificationInput

export interface ConvertLeadInput {
  title: string
  serviceId: string
  contractedFee: number | string
  clientId?: string
  clientName?: string
  description?: string | null
  contractSignedAt?: string
  dueAt?: string
  stakeholderUserIds: string[]
}
