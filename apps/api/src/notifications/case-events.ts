import { AppDataSource } from '../data-source'
import { LegalCase } from '../entities/LegalCase'
import { Notification, type NotificationChannel } from '../entities/Notification'
import { enabledNotificationChannels } from './preferences'
import {
  isDeliverableNotificationChannel,
  notificationChannelCatalog,
  type DeliverableNotificationChannel,
} from './catalog'
import { notify } from './service'

export type LegalCaseEventType =
  | 'process.created'
  | 'process.status_changed'
  | 'process.document_available'
  | 'process.action_required'
  | 'process.completed'
  | 'process.failed'

export function resolveLegalCaseNotificationChannels(
  preferredChannels: NotificationChannel[],
  availableChannels: ReadonlySet<NotificationChannel>,
): DeliverableNotificationChannel[] {
  const resolved = preferredChannels
    .filter(isDeliverableNotificationChannel)
    .filter((channel) => availableChannels.has(channel))
  return resolved.length ? resolved : ['internal']
}

export async function notifyLegalCaseEvent(input: {
  legalCaseId: string
  eventType: LegalCaseEventType
  title: string
  body: string
  actorUserId?: string | null
  eventKey?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  const legalCase = await AppDataSource.getRepository(LegalCase).findOne({
    where: { id: input.legalCaseId },
    relations: ['company', 'stakeholders', 'stakeholders.user'],
  })
  if (!legalCase) return
  const idempotencyKey = `${legalCase.id}:${input.eventType}:${input.eventKey ?? 'default'}`

  const results = await Promise.allSettled(
    legalCase.stakeholders.map(async ({ user }) => {
      const existing = await AppDataSource.getRepository(Notification).existsBy({
        companyId: legalCase.companyId,
        recipientUserId: user.id,
        idempotencyKey,
      })
      if (existing) return
      const availableChannels = new Set(
        notificationChannelCatalog(legalCase.company, user)
          .filter(({ availableForUser }) => availableForUser)
          .map(({ channel }) => channel),
      )
      const channels = resolveLegalCaseNotificationChannels(
        await enabledNotificationChannels(AppDataSource.manager, user.id),
        availableChannels,
      )
      await notify({
        companyId: legalCase.companyId,
        channels,
        recipient: { userId: user.id, email: user.email ?? undefined, phone: user.phone ?? undefined },
        title: input.title,
        body: input.body,
        metadata: {
          legalCaseId: legalCase.id,
          caseType: legalCase.caseType,
          clientId: legalCase.clientId,
          ...(input.metadata ?? {}),
        },
        createdByUserId: input.actorUserId ?? null,
        legalCaseId: legalCase.id,
        eventType: input.eventType,
        idempotencyKey,
      })
    }),
  )
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('Falha ao criar uma notificação de processo', result.reason)
    }
  }
}
