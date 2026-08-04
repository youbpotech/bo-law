import { Company } from '../entities/Company'
import {
  NOTIFICATION_CHANNELS,
  type NotificationChannel,
} from '../entities/Notification'
import { User } from '../entities/User'
import { leadConfig } from '../leads/config'
import { notificationConfig } from './config'

export const DELIVERABLE_NOTIFICATION_CHANNELS = ['internal', 'email', 'whatsapp'] as const
export type DeliverableNotificationChannel =
  (typeof DELIVERABLE_NOTIFICATION_CHANNELS)[number]

export type NotificationChannelCatalogItem = {
  channel: NotificationChannel
  supported: true
  implemented: boolean
  configured: boolean
  availableForUser: boolean
  reason: string | null
}

function providerConfiguration(channel: NotificationChannel, company: Company) {
  if (channel === 'internal') return { implemented: true, configured: true, reason: null }
  if (channel === 'email') {
    const configured = Boolean(notificationConfig.smtpHost && notificationConfig.emailFrom)
    return {
      implemented: true,
      configured,
      reason: configured ? null : 'O envio de email ainda não está configurado.',
    }
  }
  if (channel === 'whatsapp') {
    const configured = Boolean(
      leadConfig.twilioAccountSid &&
        leadConfig.twilioAuthToken &&
        (company.whatsappNumber || leadConfig.twilioWhatsappFrom),
    )
    return {
      implemented: true,
      configured,
      reason: configured ? null : 'O envio por WhatsApp ainda não está configurado.',
    }
  }
  return {
    implemented: false,
    configured: false,
    reason: 'O canal SMS é suportado pela plataforma, mas ainda não possui implementação.',
  }
}

export function notificationChannelCatalog(
  company: Company,
  user?: Pick<User, 'email' | 'phone'> | null,
): NotificationChannelCatalogItem[] {
  return NOTIFICATION_CHANNELS.map((channel) => {
    const provider = providerConfiguration(channel, company)
    let reason = provider.reason
    let hasRecipient = true
    if (provider.configured && user && channel === 'email' && !user.email) {
      hasRecipient = false
      reason = 'O utilizador não possui endereço de email.'
    }
    if (provider.configured && user && channel === 'whatsapp' && !user.phone) {
      hasRecipient = false
      reason = 'O utilizador não possui telefone.'
    }
    return {
      channel,
      supported: true as const,
      implemented: provider.implemented,
      configured: provider.configured,
      availableForUser: provider.implemented && provider.configured && hasRecipient,
      reason,
    }
  })
}

export function isDeliverableNotificationChannel(
  channel: NotificationChannel,
): channel is DeliverableNotificationChannel {
  return DELIVERABLE_NOTIFICATION_CHANNELS.includes(channel as DeliverableNotificationChannel)
}
