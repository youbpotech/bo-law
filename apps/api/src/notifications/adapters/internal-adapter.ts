import type {
  NotificationChannelAdapter,
  NotificationDeliveryResult,
  NotificationMessage,
} from '../contracts'

export class InternalNotificationAdapter implements NotificationChannelAdapter {
  readonly channel = 'internal' as const

  async send(message: NotificationMessage): Promise<NotificationDeliveryResult> {
    return { providerMessageId: message.notificationId }
  }
}
