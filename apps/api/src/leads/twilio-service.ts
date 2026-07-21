import twilio from 'twilio'
import { leadConfig } from './config'

export const twilioClient =
  leadConfig.twilioAccountSid && leadConfig.twilioAuthToken
    ? twilio(leadConfig.twilioAccountSid, leadConfig.twilioAuthToken)
    : null

export function normalizeWhatsappPhone(value: string) {
  return value
    .trim()
    .replace(/^whatsapp:/i, '')
    .replace(/[\s().-]/g, '')
}

export function toWhatsappAddress(value: string) {
  return value.startsWith('whatsapp:') ? value : `whatsapp:${value}`
}

export async function sendWhatsappMessage(to: string, body: string, from?: string) {
  const sender = from || leadConfig.twilioWhatsappFrom
  if (!twilioClient || !sender) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Twilio não está configurada para envio em produção')
    }
    return { sid: `mock-${Date.now()}` }
  }
  return twilioClient.messages.create({
    from: toWhatsappAddress(sender),
    to: toWhatsappAddress(to),
    body,
  })
}

export function emptyTwiml() {
  return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
}

export function validateTwilioRequest(
  signature: string,
  url: string,
  body: Record<string, unknown>,
) {
  if (!leadConfig.validateTwilioSignature) return true
  return (
    Boolean(leadConfig.twilioAuthToken) &&
    twilio.validateRequest(
      leadConfig.twilioAuthToken,
      signature,
      url,
      body as Record<string, string>,
    )
  )
}
