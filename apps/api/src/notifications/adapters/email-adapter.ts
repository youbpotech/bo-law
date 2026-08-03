import nodemailer from 'nodemailer'
import type {
  NotificationChannelAdapter,
  NotificationDeliveryResult,
  NotificationMessage,
} from '../contracts'
import { notificationConfig } from '../config'

export class EmailNotificationAdapter implements NotificationChannelAdapter {
  readonly channel = 'email' as const

  async send(message: NotificationMessage): Promise<NotificationDeliveryResult> {
    if (!notificationConfig.smtpHost || !notificationConfig.emailFrom) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('SMTP não está configurado para envio de notificações')
      }
      return { providerMessageId: `mock-email-${Date.now()}` }
    }

    const transporter = nodemailer.createTransport({
      host: notificationConfig.smtpHost,
      port: notificationConfig.smtpPort,
      secure: notificationConfig.smtpSecure,
      auth: notificationConfig.smtpUser
        ? {
            user: notificationConfig.smtpUser,
            pass: notificationConfig.smtpPassword,
          }
        : undefined,
    })
    const result = await transporter.sendMail({
      from: notificationConfig.emailFrom,
      to: message.recipient,
      subject: message.title,
      text: message.body,
    })
    return { providerMessageId: result.messageId }
  }
}
