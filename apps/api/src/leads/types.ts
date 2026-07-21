import {
  ConversationStatus,
  Lead,
  LeadSalesStage,
  LeadSourceChannel,
  LeadUrgency,
  QualificationLevel,
} from '../entities/Lead'

export type DocumentReadiness = 'none' | 'partial' | 'complete'

export type LeadProfilePatch = {
  name: string | null
  email: string | null
  legalArea: string | null
  serviceType: string | null
  caseSummary: string | null
  jurisdiction: string | null
  urgency: LeadUrgency | null
  deadline: string | null
  feeBudget: number | null
  clearFeeBudget?: boolean
  paymentCapacity: string | null
  documentReadiness: DocumentReadiness | null
  requestedHumanHelp: boolean
  meetingDecision: 'accepted' | 'declined' | null
  preferredDay: string | null
  preferredTime: string | null
  summary: string | null
}

export type QualificationField =
  | 'name'
  | 'legalArea'
  | 'serviceType'
  | 'caseSummary'
  | 'jurisdiction'
  | 'urgency'
  | 'deadline'
  | 'documentReadiness'
  | 'feeBudget'
  | 'paymentCapacity'

export type MeetingStage = 'not_offered' | 'collecting_preference' | 'requested' | 'declined'

export type LeadConversationProfile = {
  meetingStage: MeetingStage
  preferredDay: string | null
  preferredTime: string | null
  meetingPreferenceRaw: string | null
  askedProfileFields: QualificationField[]
  activeGuidanceField: QualificationField | null
  profileRecapSent: boolean
  pendingFeeBudgetConfirmation: number | null
}

export type LeadListFilters = {
  companyId: number
  page: number
  limit: number
  search?: string
  conversationStatus?: ConversationStatus
  qualificationLevel?: QualificationLevel
  salesStage?: LeadSalesStage
}

export type CreateLeadInput = {
  clientId?: string | null
  phone: string
  email?: string | null
  name?: string | null
  sourceChannel?: LeadSourceChannel
  legalArea?: string | null
  serviceType?: string | null
  caseSummary?: string | null
  jurisdiction?: string | null
  urgency?: LeadUrgency | null
  deadline?: string | null
  feeBudget?: number | null
  paymentCapacity?: string | null
  documentReadiness?: DocumentReadiness | null
  requestedHumanHelp?: boolean
  conversationStatus?: ConversationStatus
  salesStage?: LeadSalesStage
  interviewAt?: Date | null
  rehydrateAt?: Date | null
}

export type UpdateLeadInput = Partial<Omit<CreateLeadInput, 'phone'>> & {
  phone?: string
}

export type QualificationLead = Pick<
  Lead,
  | 'name'
  | 'legalArea'
  | 'serviceType'
  | 'caseSummary'
  | 'jurisdiction'
  | 'urgency'
  | 'deadline'
  | 'documentReadiness'
  | 'feeBudget'
  | 'paymentCapacity'
>
