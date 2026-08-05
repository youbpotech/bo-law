import { createHash, randomUUID } from 'node:crypto'
import { EntityManager } from 'typeorm'
import { AppDataSource } from '../data-source'
import { LegalCase, type LegalCaseType } from '../entities/LegalCase'
import {
  LegalCaseIntegration,
  type LegalCaseIntegrationProvider,
  type LegalCaseIntegrationState,
} from '../entities/LegalCaseIntegration'
import { LegalCaseStakeholder } from '../entities/LegalCaseStakeholder'
import { User } from '../entities/User'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class LegalCaseParticipantValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LegalCaseParticipantValidationError'
  }
}

export function parseStakeholderUserIds(value: unknown): string[] {
  if (value === undefined) return []
  if (
    !Array.isArray(value) ||
    value.some((id) => typeof id !== 'string' || !UUID_PATTERN.test(id.trim()))
  ) {
    throw new LegalCaseParticipantValidationError(
      'A lista de utilizadores a notificar é inválida.',
    )
  }
  return Array.from(new Set(value.map((id) => id.trim()).filter(Boolean)))
}

export async function saveLegalCaseStakeholders(
  manager: EntityManager,
  input: {
    legalCaseId: string
    companyId: number
    creatorUserId: string
    stakeholderUserIds: Iterable<string>
  },
): Promise<void> {
  const additionalIds = Array.from(new Set(input.stakeholderUserIds)).filter(
    (id) => id !== input.creatorUserId,
  )
  const participantIds = [input.creatorUserId, ...additionalIds]
  if (participantIds.some((id) => !UUID_PATTERN.test(id))) {
    throw new LegalCaseParticipantValidationError(
      'O criador e os stakeholders devem ser utilizadores válidos.',
    )
  }
  const tenantUsers = await manager
    .getRepository(User)
    .createQueryBuilder('user')
    .where('user.companyId = :companyId', { companyId: input.companyId })
    .andWhere('user.id IN (:...ids)', { ids: participantIds })
    .getMany()
  if (tenantUsers.length !== participantIds.length) {
    throw new LegalCaseParticipantValidationError(
      'O criador e os stakeholders devem pertencer à empresa atual.',
    )
  }

  await manager.getRepository(LegalCaseStakeholder).upsert(
    [
      {
        legalCaseId: input.legalCaseId,
        userId: input.creatorUserId,
        role: 'creator' as const,
      },
      ...additionalIds.map((userId) => ({
        legalCaseId: input.legalCaseId,
        userId,
        role: 'stakeholder' as const,
      })),
    ],
    ['legalCaseId', 'userId'],
  )
}

type PrepareIntegratedLegalCaseInput = {
  companyId: number
  clientId: string
  creatorUserId: string
  stakeholderUserIds: string[]
  caseType: Extract<LegalCaseType, 'niss' | 'aima'>
  title: string
  serviceId: string
  description?: string | null
  provider: LegalCaseIntegrationProvider
  externalReference: string
  metadata?: Record<string, unknown>
}

export type PreparedIntegratedLegalCase = {
  legalCase: LegalCase
  integration: LegalCaseIntegration
  alreadyIntegrated: boolean
  processingToken: string | null
}

export class IntegrationAlreadyProcessingError extends Error {
  constructor() {
    super('Este processo já está sendo integrado. Aguarde a conclusão antes de tentar novamente.')
    this.name = 'IntegrationAlreadyProcessingError'
  }
}

export type RemoteIntegratedLegalCaseSnapshot = {
  companyId: number
  clientId: string
  caseType: Extract<LegalCaseType, 'niss' | 'aima'>
  title: string
  serviceType: string
  provider: LegalCaseIntegrationProvider
  externalProcessId: string
  externalReference: string
  operationalStatus: number
  operationalStatusName: string
  remoteCreatedAt?: string | null
  remoteUpdatedAt?: string | null
  remoteStage?: string | null
  terminal: boolean
  actionRequired: boolean
  metadata?: Record<string, unknown>
}

export type IntegratedLegalCaseTransition = {
  integration: LegalCaseIntegration
  eventType: 'process.status_changed' | 'process.action_required' | 'process.completed' | null
  eventKey: string
  stageChanged: boolean
  previousStage: string | null
  currentStage: string | null
}

function isIntegrated(integration: LegalCaseIntegration): boolean {
  return Boolean(
    integration.externalProcessId && ['active', 'completed'].includes(integration.status),
  )
}

async function findIntegration(provider: LegalCaseIntegrationProvider, externalReference: string) {
  return AppDataSource.getRepository(LegalCaseIntegration).findOne({
    where: { provider, externalReference },
    relations: ['legalCase'],
  })
}

function validRemoteDate(value?: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function isStaleRemoteSnapshot(
  storedRemoteUpdatedAt: unknown,
  incomingRemoteUpdatedAt?: string | null,
): boolean {
  const stored =
    typeof storedRemoteUpdatedAt === 'string'
      ? validRemoteDate(storedRemoteUpdatedAt)
      : null
  if (!stored) return false
  const incoming = validRemoteDate(incomingRemoteUpdatedAt)
  return !incoming || incoming.getTime() < stored.getTime()
}

function snapshotStatus(input: RemoteIntegratedLegalCaseSnapshot): LegalCaseIntegrationState {
  return input.terminal ? 'completed' : 'active'
}

function snapshotMetadata(
  input: RemoteIntegratedLegalCaseSnapshot,
  current: Record<string, unknown> = {},
) {
  return {
    ...current,
    ...(input.metadata ?? {}),
    remoteOperationalStatus: input.operationalStatus,
    remoteOperationalStatusName: input.operationalStatusName,
    remoteUpdatedAt: input.remoteUpdatedAt ?? null,
    remoteStage: normalizedStageValue(input.remoteStage),
  }
}

function normalizedStageValue(value?: string | null): string | null {
  const result = value?.trim()
  return result || null
}

function comparableStage(value?: string | null): string | null {
  const normalized = normalizedStageValue(value)
  return normalized
    ? normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    : null
}

export function hasRemoteStageChanged(
  previousStage?: string | null,
  currentStage?: string | null,
): boolean {
  const previous = comparableStage(previousStage)
  const current = comparableStage(currentStage)
  return Boolean(previous && current && previous !== current)
}

export function remoteStageEventKey(externalProcessId: string, stage: string): string {
  const normalized = comparableStage(stage) ?? stage
  const stageHash = createHash('sha256').update(normalized).digest('hex').slice(0, 24)
  return `remote:${externalProcessId}:stage:${stageHash}`
}

function assertIntegratedCaseOwnership(
  integration: LegalCaseIntegration,
  input: RemoteIntegratedLegalCaseSnapshot,
) {
  if (
    integration.legalCase.companyId !== input.companyId ||
    integration.legalCase.clientId !== input.clientId ||
    integration.legalCase.caseType !== input.caseType
  ) {
    throw new Error('O processo externo já está associado a outro cliente ou empresa.')
  }
}

export async function syncIntegratedLegalCaseSnapshot(
  integration: LegalCaseIntegration,
  input: RemoteIntegratedLegalCaseSnapshot,
): Promise<IntegratedLegalCaseTransition> {
  return AppDataSource.transaction(async (manager) => {
    const current = await manager.getRepository(LegalCaseIntegration).findOne({
      where: { id: integration.id },
      lock: { mode: 'pessimistic_write' },
    })
    if (!current) throw new Error('A integração do processo jurídico não foi encontrada.')
    const legalCase = await manager.getRepository(LegalCase).findOne({
      where: { id: current.legalCaseId },
      lock: { mode: 'pessimistic_write' },
    })
    if (!legalCase) throw new Error('O processo jurídico da integração não foi encontrado.')
    current.legalCase = legalCase
    assertIntegratedCaseOwnership(current, input)

    if (isStaleRemoteSnapshot(current.metadata.remoteUpdatedAt, input.remoteUpdatedAt)) {
      return {
        integration: current,
        eventType: null,
        eventKey: `remote:${input.externalProcessId}:stale`,
        stageChanged: false,
        previousStage: null,
        currentStage: normalizedStageValue(input.remoteStage),
      }
    }

    const previousStatus =
      typeof current.metadata.remoteOperationalStatusName === 'string'
        ? current.metadata.remoteOperationalStatusName
        : null
    const remoteChanged = previousStatus !== input.operationalStatusName
    const previousStage = normalizedStageValue(
      typeof current.metadata.remoteStage === 'string'
        ? current.metadata.remoteStage
        : typeof current.metadata.currentState === 'string'
          ? current.metadata.currentState
          : null,
    )
    const currentStage = normalizedStageValue(input.remoteStage)
    const stageChanged = hasRemoteStageChanged(previousStage, currentStage)
    const nextIntegrationStatus = snapshotStatus(input)
    const becameTerminal = current.status !== 'completed' && input.terminal
    const reopened = current.status === 'completed' && !input.terminal

    if (
      remoteChanged ||
      current.metadata.remoteStage !== currentStage ||
      current.status !== nextIntegrationStatus ||
      current.metadata.remoteUpdatedAt !== (input.remoteUpdatedAt ?? null)
    ) {
      await manager.getRepository(LegalCaseIntegration).save({
        id: current.id,
        status: nextIntegrationStatus,
        lastError: null,
        metadata: snapshotMetadata(input, current.metadata),
      })
      await manager.getRepository(LegalCase).update(current.legalCaseId, {
        integrationStatus: input.terminal ? 'completed' : 'active',
        stage: input.terminal ? 'closed' : reopened ? 'diligences' : current.legalCase.stage,
        completedAt: input.terminal
          ? (current.legalCase.completedAt ??
            validRemoteDate(input.remoteUpdatedAt) ??
            new Date())
          : reopened
            ? null
            : current.legalCase.completedAt,
      })
      current.status = nextIntegrationStatus
      current.metadata = snapshotMetadata(input, current.metadata)
      current.legalCase.integrationStatus = input.terminal ? 'completed' : 'active'
      if (input.terminal) {
        current.legalCase.stage = 'closed'
        current.legalCase.completedAt ??=
          validRemoteDate(input.remoteUpdatedAt) ?? new Date()
      } else if (reopened) {
        current.legalCase.stage = 'diligences'
        current.legalCase.completedAt = null
      }
    }

    let eventType: IntegratedLegalCaseTransition['eventType'] = null
    if ((remoteChanged || reopened) && input.actionRequired) {
      eventType = 'process.action_required'
    } else if (remoteChanged && becameTerminal) {
      eventType = 'process.completed'
    } else if (stageChanged || (remoteChanged && previousStatus)) {
      eventType = 'process.status_changed'
    }
    const eventKey = stageChanged && eventType === 'process.status_changed' && currentStage
      ? remoteStageEventKey(input.externalProcessId, currentStage)
      : `remote:${input.externalProcessId}:${input.operationalStatusName}:${input.remoteUpdatedAt ?? 'unknown'}`
    return { integration: current, eventType, eventKey, stageChanged, previousStage, currentStage }
  })
}

export async function prepareIntegratedLegalCase(
  input: PrepareIntegratedLegalCaseInput,
): Promise<PreparedIntegratedLegalCase> {
  const existing = await findIntegration(input.provider, input.externalReference)
  if (existing) {
    if (
      existing.legalCase.companyId !== input.companyId ||
      existing.legalCase.clientId !== input.clientId ||
      existing.legalCase.caseType !== input.caseType
    ) {
      throw new Error('Esta referência externa já está associada a outro processo.')
    }
    if (!isIntegrated(existing)) {
      const processingToken = randomUUID()
      await AppDataSource.transaction(async (manager) => {
        await saveLegalCaseStakeholders(manager, {
          legalCaseId: existing.legalCaseId,
          companyId: input.companyId,
          creatorUserId: existing.legalCase.createdByUserId,
          stakeholderUserIds: input.stakeholderUserIds,
        })
        const claimed: Array<{ id: string }> = await manager.query(
          `UPDATE "bo"."legal_case_integrations"
              SET "status" = 'processing',
                  "processing_token" = $2,
                  "processing_started_at" = now(),
                  "last_error" = NULL,
                  "updated_at" = now()
            WHERE "id" = $1
              AND (
                "status" IN ('pending', 'failed')
                OR ("status" = 'active' AND "external_process_id" IS NULL)
                OR (
                  "status" = 'processing'
                  AND "processing_started_at" < now() - interval '2 minutes'
                )
              )
            RETURNING "id"`,
          [existing.id, processingToken],
        )
        if (!claimed[0]) throw new IntegrationAlreadyProcessingError()
        await manager.getRepository(LegalCase).update(existing.legalCaseId, {
          integrationStatus: 'pending',
        })
      })
      existing.status = 'processing'
      existing.processingToken = processingToken
      existing.processingStartedAt = new Date()
      existing.lastError = null
      existing.legalCase.integrationStatus = 'pending'
      return {
        legalCase: existing.legalCase,
        integration: existing,
        alreadyIntegrated: false,
        processingToken,
      }
    }
    return {
      legalCase: existing.legalCase,
      integration: existing,
      alreadyIntegrated: true,
      processingToken: null,
    }
  }

  try {
    const processingToken = randomUUID()
    return await AppDataSource.transaction(async (manager) => {
      const legalCase = await manager.getRepository(LegalCase).save(
        manager.getRepository(LegalCase).create({
          companyId: input.companyId,
          clientId: input.clientId,
          leadId: null,
          createdByUserId: input.creatorUserId,
          caseType: input.caseType,
          integrationStatus: 'pending',
          title: input.title,
          serviceId: input.serviceId,
          description: input.description ?? null,
          contractedFee: null,
          stage: 'diligences',
          documentsComplete: false,
          contractSignedAt: null,
          startedAt: new Date(),
          completedAt: null,
        }),
      )
      await saveLegalCaseStakeholders(manager, {
        legalCaseId: legalCase.id,
        companyId: input.companyId,
        creatorUserId: input.creatorUserId,
        stakeholderUserIds: input.stakeholderUserIds,
      })
      const integration = await manager.getRepository(LegalCaseIntegration).save(
        manager.getRepository(LegalCaseIntegration).create({
          legalCaseId: legalCase.id,
          provider: input.provider,
          externalProcessId: null,
          externalReference: input.externalReference,
          status: 'processing',
          lastError: null,
          processingToken,
          processingStartedAt: new Date(),
          metadata: input.metadata ?? {},
        }),
      )
      return { legalCase, integration, alreadyIntegrated: false, processingToken }
    })
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      const concurrent = await findIntegration(input.provider, input.externalReference)
      if (concurrent) return prepareIntegratedLegalCase(input)
    }
    throw error
  }
}

export async function activateLegalCaseIntegration(
  legalCaseId: string,
  integrationId: string,
  externalProcessId: string,
  processingToken: string,
): Promise<boolean> {
  return AppDataSource.transaction(async (manager) => {
    const result = await manager.getRepository(LegalCaseIntegration).update(
      {
        id: integrationId,
        legalCaseId,
        status: 'processing',
        processingToken,
      },
      {
        externalProcessId,
        status: 'active',
        lastError: null,
        processingToken: null,
        processingStartedAt: null,
      },
    )
    if (!result.affected) return false
    await manager.getRepository(LegalCase).update(legalCaseId, {
      integrationStatus: 'active',
    })
    return true
  })
}

export async function failLegalCaseIntegration(
  legalCaseId: string,
  integrationId: string,
  processingToken: string,
  error: unknown,
): Promise<boolean> {
  const message = (error instanceof Error ? error.message : 'Falha desconhecida').slice(0, 2_000)
  return AppDataSource.transaction(async (manager) => {
    const result = await manager.getRepository(LegalCaseIntegration).update(
      {
        id: integrationId,
        legalCaseId,
        status: 'processing',
        processingToken,
      },
      {
        status: 'failed',
        lastError: message,
        processingToken: null,
        processingStartedAt: null,
      },
    )
    if (!result.affected) return false
    await manager.getRepository(LegalCase).update(legalCaseId, {
      integrationStatus: 'failed',
    })
    return true
  })
}

export async function listCompanyCaseIntegrations(
  companyId: number,
  provider: LegalCaseIntegrationProvider,
) {
  return AppDataSource.getRepository(LegalCaseIntegration)
    .createQueryBuilder('integration')
    .innerJoinAndSelect('integration.legalCase', 'legalCase')
    .innerJoinAndSelect('legalCase.client', 'client')
    .where('legalCase.companyId = :companyId', { companyId })
    .andWhere('integration.provider = :provider', { provider })
    .getMany()
}

export async function findCompanyCaseIntegrationByExternalId(
  companyId: number,
  provider: LegalCaseIntegrationProvider,
  externalProcessId: string,
) {
  return AppDataSource.getRepository(LegalCaseIntegration)
    .createQueryBuilder('integration')
    .innerJoinAndSelect('integration.legalCase', 'legalCase')
    .innerJoinAndSelect('legalCase.client', 'client')
    .where('legalCase.companyId = :companyId', { companyId })
    .andWhere('integration.provider = :provider', { provider })
    .andWhere('integration.externalProcessId = :externalProcessId', { externalProcessId })
    .getOne()
}

export function loadLegalCaseWithParticipants(id: string, companyId: number) {
  return AppDataSource.getRepository(LegalCase).findOne({
    where: { id, companyId },
    relations: [
      'client',
      'lead',
      'invoices',
      'createdByUser',
      'stakeholders',
      'stakeholders.user',
      'integrations',
    ],
    order: { invoices: { createdAt: 'ASC' } },
  })
}
