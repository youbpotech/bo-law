import { AppDataSource } from '../data-source'
import {
  ConversationStatus,
  Lead,
  LeadSalesStage,
  LeadSourceChannel,
  QualificationLevel,
} from '../entities/Lead'
import {
  CreateLeadInput,
  LeadConversationProfile,
  LeadListFilters,
  LeadProfilePatch,
  UpdateLeadInput,
} from './types'

export async function findOrCreateLeadByPhone(
  companyId: number,
  phone: string,
  sourceChannel: LeadSourceChannel = 'other',
): Promise<Lead> {
  await AppDataSource.query(
    `INSERT INTO "bo"."leads" ("company_id", "phone", "source_channel")
     VALUES ($1, $2, $3)
     ON CONFLICT ("company_id", "phone") DO NOTHING`,
    [companyId, phone, sourceChannel],
  )
  const lead = await AppDataSource.getRepository(Lead).findOneBy({ companyId, phone })
  if (!lead) throw new Error('Não foi possível criar o lead')
  return lead
}

export function getLeadById(companyId: number, id: string): Promise<Lead | null> {
  return AppDataSource.getRepository(Lead).findOneBy({ id, companyId })
}

export function getLeadDetail(companyId: number, id: string): Promise<Lead | null> {
  return AppDataSource.getRepository(Lead).findOne({
    where: { id, companyId },
    relations: {
      legalCase: {
        invoices: true,
      },
    },
  })
}

export function getLeadByIdForProcessing(id: string): Promise<Lead | null> {
  return AppDataSource.getRepository(Lead).findOneBy({ id })
}

export async function listLeads(filters: LeadListFilters) {
  const repository = AppDataSource.getRepository(Lead)
  const query = repository
    .createQueryBuilder('lead')
    .where('lead.companyId = :companyId', { companyId: filters.companyId })

  if (filters.search) {
    query.andWhere(
      '(lead.name ILIKE :search OR lead.phone ILIKE :search OR lead.email ILIKE :search)',
      {
        search: `%${filters.search}%`,
      },
    )
  }
  if (filters.conversationStatus) {
    query.andWhere('lead.conversationStatus = :conversationStatus', {
      conversationStatus: filters.conversationStatus,
    })
  }
  if (filters.qualificationLevel) {
    query.andWhere('lead.qualificationLevel = :qualificationLevel', {
      qualificationLevel: filters.qualificationLevel,
    })
  }
  if (filters.salesStage) {
    query.andWhere('lead.salesStage = :salesStage', { salesStage: filters.salesStage })
  }

  const [data, total] = await query
    .orderBy('lead.lastMessageAt', 'DESC', 'NULLS LAST')
    .addOrderBy('lead.createdAt', 'DESC')
    .skip((filters.page - 1) * filters.limit)
    .take(filters.limit)
    .getManyAndCount()

  const summaryRows: Array<{ level: QualificationLevel; count: string }> =
    await AppDataSource.query(
      `SELECT "qualification_level" AS level, count(*)::text AS count
     FROM "bo"."leads"
     WHERE "company_id" = $1
     GROUP BY "qualification_level"`,
      [filters.companyId],
    )
  const [awaitingRows, totalRows]: [Array<{ count: string }>, Array<{ count: string }>] =
    await Promise.all([
      AppDataSource.query(
        `SELECT count(*)::text AS count FROM "bo"."leads"
       WHERE "company_id" = $1 AND "conversation_status" = 'awaiting_human'`,
        [filters.companyId],
      ),
      AppDataSource.query(
        `SELECT count(*)::text AS count FROM "bo"."leads" WHERE "company_id" = $1`,
        [filters.companyId],
      ),
    ])
  const byLevel = { frio: 0, morno: 0, quente: 0 }
  for (const row of summaryRows) byLevel[row.level] = Number(row.count)

  return {
    data,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
    summary: {
      total: Number(totalRows[0]?.count ?? 0),
      awaitingHuman: Number(awaitingRows[0]?.count ?? 0),
      byLevel,
    },
  }
}

export async function createLead(companyId: number, input: CreateLeadInput): Promise<Lead> {
  const repository = AppDataSource.getRepository(Lead)
  const lead = repository.create({
    companyId,
    clientId: null,
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
    conversationStatus: 'bot_active',
    salesStage: 'new',
    interviewAt: null,
    rehydrateAt: null,
    profile: {},
    ...input,
  })
  const qualification = calculateQualification(lead)
  lead.qualificationScore = qualification.score
  lead.qualificationLevel = qualification.level
  return repository.save(lead)
}

export async function updateLead(
  companyId: number,
  id: string,
  input: UpdateLeadInput,
): Promise<Lead | null> {
  const repository = AppDataSource.getRepository(Lead)
  const lead = await repository.findOneBy({ id, companyId })
  if (!lead) return null

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      ;(lead as unknown as Record<string, unknown>)[key] = value
    }
  }
  const qualification = calculateQualification(lead)
  lead.qualificationScore = qualification.score
  lead.qualificationLevel = qualification.level
  return repository.save(lead)
}

export async function updateLastMessage(leadId: string, content: string): Promise<void> {
  await AppDataSource.getRepository(Lead).update(leadId, {
    lastMessage: content.slice(0, 500),
    lastMessageAt: new Date(),
  })
}

export async function setLeadConversationStatus(
  companyId: number,
  leadId: string,
  conversationStatus: ConversationStatus,
): Promise<Lead | null> {
  const lead = await getLeadById(companyId, leadId)
  if (!lead) return null
  lead.conversationStatus = conversationStatus
  return AppDataSource.getRepository(Lead).save(lead)
}

export async function updateLeadConversationProfile(
  lead: Lead,
  conversation: LeadConversationProfile,
  conversationStatus: ConversationStatus = lead.conversationStatus,
) {
  const repository = AppDataSource.getRepository(Lead)
  await repository.save(
    repository.merge(lead, {
      profile: { ...lead.profile, ...conversation },
      conversationStatus,
    }),
  )
  return (await repository.findOneBy({ id: lead.id, companyId: lead.companyId }))!
}

export function calculateQualification(lead: Partial<Lead>) {
  let score = 0
  if (lead.legalArea) score += 15
  if (lead.serviceType) score += 10
  if (lead.caseSummary) score += 15
  if (lead.jurisdiction) score += 10
  if (lead.urgency) score += 10
  if (lead.deadline) score += 5
  if (lead.documentReadiness) score += 10
  if (lead.feeBudget && Number(lead.feeBudget) > 0) score += 10
  if (lead.paymentCapacity) score += 5
  if (lead.requestedHumanHelp) score += 10
  score = Math.min(score, 100)
  const level: QualificationLevel = score >= 70 ? 'quente' : score >= 40 ? 'morno' : 'frio'
  return { score, level }
}

const SALES_STAGE_TRANSITIONS: Record<LeadSalesStage, LeadSalesStage[]> = {
  new: ['new', 'interview_scheduled', 'nurturing', 'lost'],
  interview_scheduled: ['interview_scheduled', 'interview_completed', 'nurturing', 'lost'],
  interview_completed: ['interview_completed', 'nurturing', 'lost'],
  nurturing: ['nurturing', 'interview_scheduled', 'lost'],
  lost: ['lost', 'nurturing'],
  contracted: ['contracted'],
}

export function isValidSalesStageTransition(from: LeadSalesStage, to: LeadSalesStage) {
  return SALES_STAGE_TRANSITIONS[from].includes(to)
}

export function resolvePatchedFeeBudget(
  current: number | null,
  patch: Pick<LeadProfilePatch, 'feeBudget' | 'clearFeeBudget'>,
) {
  return patch.clearFeeBudget ? null : (patch.feeBudget ?? current)
}

export async function applyProfilePatch(lead: Lead, patch: LeadProfilePatch): Promise<Lead> {
  const merged: Partial<Lead> = {
    ...lead,
    name: patch.name ?? lead.name,
    email: patch.email ?? lead.email,
    legalArea: patch.legalArea ?? lead.legalArea,
    serviceType: patch.serviceType ?? lead.serviceType,
    caseSummary: patch.caseSummary ?? lead.caseSummary,
    jurisdiction: patch.jurisdiction ?? lead.jurisdiction,
    urgency: patch.urgency ?? lead.urgency,
    deadline: patch.deadline ?? lead.deadline,
    feeBudget: resolvePatchedFeeBudget(
      lead.feeBudget === null ? null : Number(lead.feeBudget),
      patch,
    ),
    paymentCapacity: patch.paymentCapacity ?? lead.paymentCapacity,
    documentReadiness: patch.documentReadiness ?? lead.documentReadiness,
    requestedHumanHelp: patch.requestedHumanHelp || lead.requestedHumanHelp,
  }
  const qualification = calculateQualification(merged)
  const repository = AppDataSource.getRepository(Lead)
  await repository.save(
    repository.merge(lead, {
      name: merged.name,
      email: merged.email,
      legalArea: merged.legalArea,
      serviceType: merged.serviceType,
      caseSummary: merged.caseSummary,
      jurisdiction: merged.jurisdiction,
      urgency: merged.urgency,
      deadline: merged.deadline,
      feeBudget: merged.feeBudget,
      paymentCapacity: merged.paymentCapacity,
      documentReadiness: merged.documentReadiness,
      requestedHumanHelp: merged.requestedHumanHelp,
      qualificationScore: qualification.score,
      qualificationLevel: qualification.level,
      profile: {
        ...lead.profile,
        latestSummary: patch.summary ?? lead.profile.latestSummary ?? null,
      },
    }),
  )
  return (await repository.findOneBy({ id: lead.id, companyId: lead.companyId }))!
}
