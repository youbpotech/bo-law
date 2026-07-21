import { AppDataSource } from '../data-source'
import {
  LeadMessage,
  MessageDirection,
  MessageProcessingStatus,
  MessageSender,
  MessageType,
} from '../entities/LeadMessage'

type MessageInput = {
  leadId: string
  direction: MessageDirection
  senderType: MessageSender
  content: string
  twilioMessageSid?: string | null
  inReplyToMessageId?: string | null
  messageType?: MessageType
  processingStatus?: MessageProcessingStatus
  sourceContentType?: string | null
}

export async function createMessage(input: MessageInput): Promise<LeadMessage> {
  return AppDataSource.getRepository(LeadMessage).save(
    AppDataSource.getRepository(LeadMessage).create({
      ...input,
      twilioMessageSid: input.twilioMessageSid ?? null,
      inReplyToMessageId: input.inReplyToMessageId ?? null,
      messageType: input.messageType ?? 'text',
      processingStatus: input.processingStatus ?? 'ready',
      sourceContentType: input.sourceContentType ?? null,
    }),
  )
}

export async function createInboundMessageIdempotently(input: MessageInput) {
  if (!input.twilioMessageSid) return { message: await createMessage(input), created: true }
  const rows: Array<{ id: string }> = await AppDataSource.query(
    `INSERT INTO "bo"."lead_messages" (
      "lead_id", "direction", "sender_type", "content", "twilio_message_sid",
      "message_type", "processing_status", "source_content_type"
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT ("twilio_message_sid") WHERE "twilio_message_sid" IS NOT NULL DO NOTHING
    RETURNING "id"`,
    [
      input.leadId,
      input.direction,
      input.senderType,
      input.content,
      input.twilioMessageSid,
      input.messageType ?? 'text',
      input.processingStatus ?? 'ready',
      input.sourceContentType ?? null,
    ],
  )
  const repository = AppDataSource.getRepository(LeadMessage)
  if (rows[0]) return { message: (await repository.findOneBy({ id: rows[0].id }))!, created: true }
  return {
    message: (await repository.findOneBy({ twilioMessageSid: input.twilioMessageSid }))!,
    created: false,
  }
}

export async function createBotReplyIdempotently(
  leadId: string,
  inboundId: string,
  content: string,
) {
  const rows: Array<{ id: string }> = await AppDataSource.query(
    `INSERT INTO "bo"."lead_messages" ("lead_id", "direction", "sender_type", "content", "in_reply_to_message_id")
     VALUES ($1, 'outbound', 'bot', $3, $2)
     ON CONFLICT ("in_reply_to_message_id") WHERE "in_reply_to_message_id" IS NOT NULL AND "sender_type" = 'bot'
     DO NOTHING RETURNING "id"`,
    [leadId, inboundId, content],
  )
  const repository = AppDataSource.getRepository(LeadMessage)
  return rows[0]
    ? repository.findOneByOrFail({ id: rows[0].id })
    : repository.findOneByOrFail({ inReplyToMessageId: inboundId, senderType: 'bot' })
}

export async function listMessagesForLead(leadId: string, limit = 100) {
  return AppDataSource.getRepository(LeadMessage)
    .createQueryBuilder('message')
    .leftJoinAndSelect('message.audioProcessing', 'audio')
    .where('message.leadId = :leadId', { leadId })
    .orderBy('message.createdAt', 'DESC')
    .take(limit)
    .getMany()
    .then((messages) => messages.reverse())
}

export async function claimMessageForBot(messageId: string, leaseMs: number) {
  const rows: Array<{ id: string }> = await AppDataSource.query(
    `UPDATE "bo"."lead_messages" SET "bot_processing_started_at" = now()
     WHERE "id" = $1
       AND "direction" = 'inbound'
       AND "sender_type" = 'lead'
       AND "processing_status" = 'ready'
       AND "bot_processed_at" IS NULL
       AND ("bot_processing_started_at" IS NULL OR "bot_processing_started_at" < now() - ($2 * interval '1 millisecond'))
     RETURNING "id"`,
    [messageId, leaseMs],
  )
  return rows[0] ? AppDataSource.getRepository(LeadMessage).findOneBy({ id: messageId }) : null
}

export async function markMessageBotProcessed(id: string) {
  await AppDataSource.query(
    `UPDATE "bo"."lead_messages" SET "bot_processed_at" = now(), "bot_processing_started_at" = NULL WHERE "id" = $1`,
    [id],
  )
}

export async function releaseMessageBotClaim(id: string) {
  await AppDataSource.query(
    `UPDATE "bo"."lead_messages" SET "bot_processing_started_at" = NULL WHERE "id" = $1 AND "bot_processed_at" IS NULL`,
    [id],
  )
}

export async function updateMessageTwilioSid(id: string, sid: string) {
  await AppDataSource.getRepository(LeadMessage).update(id, { twilioMessageSid: sid })
}

export async function isFirstInboundMessage(id: string, leadId: string) {
  const rows: Array<{ first: boolean }> = await AppDataSource.query(
    `SELECT NOT EXISTS (
      SELECT 1 FROM "bo"."lead_messages" m
      WHERE m."lead_id" = $2 AND m."direction" = 'inbound'
        AND (m."created_at", m."id") < (SELECT "created_at", "id" FROM "bo"."lead_messages" WHERE "id" = $1)
    ) AS first`,
    [id, leadId],
  )
  return rows[0]?.first ?? false
}
