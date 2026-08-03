import { Router } from 'express'
import { AppDataSource } from '../data-source'
import { Notification } from '../entities/Notification'
import { requireAuth } from '../auth/middleware'
import { requireCurrentUser } from '../auth/current-user'

export const notificationsRouter = Router()

notificationsRouter.get('/notifications', requireAuth, async (req, res) => {
  const user = await requireCurrentUser(req, res)
  if (!user) return
  const unreadOnly = req.query.unreadOnly === 'true'
  const query = AppDataSource.getRepository(Notification)
    .createQueryBuilder('notification')
    .leftJoinAndSelect('notification.deliveries', 'delivery')
    .where('notification.companyId = :companyId', { companyId: user.companyId })
    .andWhere('notification.recipientUserId = :userId', { userId: user.id })
    .andWhere(':internal = ANY(notification.channels)', { internal: 'internal' })
    .orderBy('notification.createdAt', 'DESC')
    .take(100)
  if (unreadOnly) query.andWhere('notification.readAt IS NULL')
  res.json(await query.getMany())
})

notificationsRouter.patch('/notifications/:id/read', requireAuth, async (req, res) => {
  const user = await requireCurrentUser(req, res)
  if (!user) return
  const result = await AppDataSource.getRepository(Notification).update(
    {
      id: req.params.id,
      companyId: user.companyId,
      recipientUserId: user.id,
    },
    { readAt: new Date() },
  )
  if (!result.affected) {
    res.status(404).json({ error: 'Notificação não encontrada' })
    return
  }
  res.status(204).send()
})

notificationsRouter.patch('/notifications/read-all', requireAuth, async (req, res) => {
  const user = await requireCurrentUser(req, res)
  if (!user) return
  await AppDataSource.getRepository(Notification)
    .createQueryBuilder()
    .update()
    .set({ readAt: new Date() })
    .where('"company_id" = :companyId', { companyId: user.companyId })
    .andWhere('"recipient_user_id" = :userId', { userId: user.id })
    .andWhere('"read_at" IS NULL')
    .andWhere(':internal = ANY("channels")', { internal: 'internal' })
    .execute()
  res.status(204).send()
})

