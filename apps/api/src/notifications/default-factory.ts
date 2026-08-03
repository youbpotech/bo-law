import { EmailNotificationAdapter } from './adapters/email-adapter'
import { InternalNotificationAdapter } from './adapters/internal-adapter'
import { WhatsappNotificationAdapter } from './adapters/whatsapp-adapter'
import { NotificationChannelFactory } from './factory'

export const notificationChannelFactory = new NotificationChannelFactory()
  .register(new EmailNotificationAdapter())
  .register(new WhatsappNotificationAdapter())
  .register(new InternalNotificationAdapter())
