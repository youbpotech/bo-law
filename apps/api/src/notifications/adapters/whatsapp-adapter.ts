import { sendWhatsappMessage } from '../../leads/twilio-service'
import type {
  NotificationChannelAdapter,
  NotificationDeliveryResult,
  NotificationMessage,
} from '../contracts'

export class WhatsappNotificationAdapter implements NotificationChannelAdapter {
  readonly channel = 'whatsapp' as const

  async send(message: NotificationMessage): Promise<NotificationDeliveryResult> {
    const result = await sendWhatsappMessage(
      message.recipient,
      message.body,
      message.whatsappFrom ?? undefined,
    )
    return { providerMessageId: result.sid }
  }
}
