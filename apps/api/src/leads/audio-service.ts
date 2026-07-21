import { execFile } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { AppDataSource } from '../data-source'
import { LeadAudioProcessing } from '../entities/LeadAudioProcessing'
import { openai } from './ai-service'
import { leadConfig } from './config'
import { processInboundMessage } from './conversation-service'
import { twilioClient } from './twilio-service'

const execFileAsync = promisify(execFile)
const retryDelays = [30_000, 120_000, 600_000, 3_600_000, 21_600_000]

export const audioPendingContent = 'Áudio recebido — transcrição em andamento'
export const audioFailedContent = 'Não foi possível transcrever este áudio'

export type ParsedAudio = { contentType: string; mediaSid: string } | null

export function parseInboundAudio(payload: Record<string, unknown>): ParsedAudio {
  const count = Math.min(Math.max(Number(payload.NumMedia ?? 0) || 0, 0), 10)
  for (let index = 0; index < count; index += 1) {
    const contentType = String(payload[`MediaContentType${index}`] ?? '')
      .split(';')[0]
      .toLowerCase()
    if (!contentType.startsWith('audio/')) continue
    const messageSid = String(payload.MessageSid ?? '').trim()
    const mediaUrl = new URL(String(payload[`MediaUrl${index}`] ?? ''))
    const parts = mediaUrl.pathname.split('/').filter(Boolean)
    const mediaSid = parts.at(-1) ?? ''
    const urlMessageSid = parts.at(-3) ?? ''
    const urlAccountSid = parts.at(-5) ?? ''
    if (
      mediaUrl.protocol !== 'https:' ||
      mediaUrl.hostname !== 'api.twilio.com' ||
      !/^(SM|MM)[0-9a-zA-Z]{32}$/.test(messageSid) ||
      !/^ME[0-9a-zA-Z]{32}$/.test(mediaSid) ||
      urlMessageSid !== messageSid ||
      (leadConfig.twilioAccountSid && urlAccountSid !== leadConfig.twilioAccountSid)
    ) {
      throw new Error('Identificadores de mídia Twilio inválidos')
    }
    return { contentType, mediaSid }
  }
  return null
}

export async function createAudioJob(input: {
  messageId: string
  mediaSid: string
  contentType: string
  whatsappFrom?: string | null
}) {
  const repository = AppDataSource.getRepository(LeadAudioProcessing)
  return repository.save(
    repository.create({
      messageId: input.messageId,
      twilioMediaSid: input.mediaSid,
      contentType: input.contentType,
      whatsappFrom: input.whatsappFrom ?? null,
      transcriptionProvider: 'openai',
      transcriptionModel: leadConfig.openaiTranscriptionModel,
      language: leadConfig.audioLanguage,
    }),
  )
}

type AudioJob = {
  id: string
  message_id: string
  twilio_media_sid: string
  whatsapp_from: string | null
  attempt_count: number
  twilio_message_sid: string
  lead_id: string
  transcribed_at: Date | null
  twilio_media_deleted_at: Date | null
}

async function claimAudioJob(): Promise<AudioJob | null> {
  return AppDataSource.transaction(async (manager) => {
    const rows: AudioJob[] = await manager.query(
      `WITH candidate AS (
        SELECT a."id" FROM "bo"."lead_audio_processing" a
        JOIN "bo"."lead_messages" m ON m."id" = a."message_id"
        WHERE a."next_attempt_at" <= now() AND a."attempt_count" < $1
          AND (
            (a."transcribed_at" IS NULL AND (
              m."processing_status" = 'pending' OR (
                m."processing_status" IN ('downloading','converting','transcribing')
                AND a."updated_at" < now() - ($2 * interval '1 millisecond')
              )
            )) OR (
              a."transcribed_at" IS NOT NULL
              AND m."processing_status" = 'ready'
              AND m."bot_processed_at" IS NULL
            )
          )
        ORDER BY m."created_at" FOR UPDATE OF a SKIP LOCKED LIMIT 1
      ), claimed AS (
        UPDATE "bo"."lead_audio_processing" a
        SET "attempt_count" = a."attempt_count" + 1, "updated_at" = now(),
            "last_error_code" = NULL, "last_error_message" = NULL
        FROM candidate c WHERE a."id" = c."id" RETURNING a.*
      ), message AS (
        UPDATE "bo"."lead_messages" m
        SET "processing_status" = CASE
          WHEN c."transcribed_at" IS NULL THEN 'downloading'
          ELSE m."processing_status"
        END
        FROM claimed c WHERE m."id" = c."message_id"
        RETURNING m."id", m."twilio_message_sid", m."lead_id"
      )
      SELECT c.*, m."twilio_message_sid", m."lead_id" FROM claimed c JOIN message m ON m."id" = c."message_id"`,
      [leadConfig.audioMaxAttempts, leadConfig.audioLeaseMs],
    )
    return rows[0] ?? null
  })
}

async function setProcessingStatus(messageId: string, status: string) {
  await AppDataSource.transaction(async (manager) => {
    await manager.query(
      `UPDATE "bo"."lead_messages" SET "processing_status" = $2 WHERE "id" = $1`,
      [messageId, status],
    )
    await manager.query(
      `UPDATE "bo"."lead_audio_processing" SET "updated_at" = now() WHERE "message_id" = $1`,
      [messageId],
    )
  })
}

async function downloadAudio(job: AudioJob, destination: string) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(leadConfig.twilioAccountSid)}/Messages/${encodeURIComponent(job.twilio_message_sid)}/Media/${encodeURIComponent(job.twilio_media_sid)}`
  const authorization = Buffer.from(
    `${leadConfig.twilioAccountSid}:${leadConfig.twilioAuthToken}`,
  ).toString('base64')
  const response = await fetch(url, { headers: { Authorization: `Basic ${authorization}` } })
  if (!response.ok) throw new Error(`Twilio media download failed (${response.status})`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (!bytes.length || bytes.length > leadConfig.audioMaxBytes)
    throw new Error('Áudio vazio ou acima do limite')
  await writeFile(destination, bytes)
  return bytes.length
}

async function processAudioJob(job: AudioJob) {
  const directory = await mkdtemp(join(tmpdir(), 'bo-lead-audio-'))
  const source = join(directory, 'source')
  const normalized = join(directory, 'normalized.mp3')
  let transcribed = Boolean(job.transcribed_at)
  try {
    if (!transcribed) {
      if (!openai) throw new Error('OpenAI não está configurada')
      const byteSize = await downloadAudio(job, source)
      await setProcessingStatus(job.message_id, 'converting')
      await execFileAsync(
        'ffmpeg',
        [
          '-nostdin',
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          '-i',
          source,
          '-vn',
          '-ac',
          '1',
          '-ar',
          '16000',
          '-codec:a',
          'libmp3lame',
          '-b:a',
          '64k',
          normalized,
        ],
        { timeout: leadConfig.audioTimeoutMs },
      )
      await setProcessingStatus(job.message_id, 'transcribing')
      const transcription = await openai.audio.transcriptions.create(
        {
          file: createReadStream(normalized),
          model: leadConfig.openaiTranscriptionModel,
          language: leadConfig.audioLanguage,
          response_format: 'json',
          temperature: 0,
        },
        { timeout: leadConfig.audioTimeoutMs, maxRetries: 0 },
      )
      const text = transcription.text?.trim()
      if (!text) throw new Error('Transcrição vazia')
      await AppDataSource.transaction(async (manager) => {
        await manager.query(
          `UPDATE "bo"."lead_messages" SET "content" = $2, "processing_status" = 'ready' WHERE "id" = $1`,
          [job.message_id, text],
        )
        await manager.query(
          `UPDATE "bo"."lead_audio_processing" SET "byte_size" = $2, "transcribed_at" = now(), "next_attempt_at" = now(), "updated_at" = now() WHERE "id" = $1`,
          [job.id, byteSize],
        )
        await manager.query(
          `UPDATE "bo"."leads" SET "last_message" = $2, "last_message_at" = now(), "updated_at" = now() WHERE "id" = $1`,
          [job.lead_id, text.slice(0, 500)],
        )
      })
      transcribed = true
    }

    let mediaDeletionError: Error | null = null
    if (twilioClient && !job.twilio_media_deleted_at) {
      try {
        await twilioClient.messages(job.twilio_message_sid).media(job.twilio_media_sid).remove()
        await AppDataSource.getRepository(LeadAudioProcessing).update(job.id, {
          twilioMediaDeletedAt: new Date(),
        })
      } catch (error) {
        mediaDeletionError =
          error instanceof Error ? error : new Error('Falha ao apagar mídia Twilio')
        console.error(`Twilio media cleanup failed messageId=${job.message_id}`, error)
      }
    }

    await processInboundMessage(job.message_id, job.whatsapp_from ?? undefined)
    await AppDataSource.getRepository(LeadAudioProcessing).update(job.id, {
      nextAttemptAt: null,
      lastErrorCode: mediaDeletionError ? 'twilio_media_delete_failed' : null,
      lastErrorMessage: mediaDeletionError?.message.slice(0, 500) ?? null,
    })
  } catch (error) {
    const retry = job.attempt_count < leadConfig.audioMaxAttempts
    const delay = retryDelays[Math.min(job.attempt_count - 1, retryDelays.length - 1)]
    await AppDataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE "bo"."lead_audio_processing" SET "next_attempt_at" = CASE WHEN $2 THEN now() + ($3 * interval '1 millisecond') ELSE NULL END,
         "last_error_code" = $4, "last_error_message" = $5, "updated_at" = now() WHERE "id" = $1`,
        [
          job.id,
          retry,
          delay,
          transcribed ? 'conversation_processing_failed' : 'audio_processing_failed',
          error instanceof Error ? error.message.slice(0, 500) : 'Erro desconhecido',
        ],
      )
      if (!transcribed) {
        await manager.query(
          `UPDATE "bo"."lead_messages" SET "processing_status" = $2, "content" = CASE WHEN $2 = 'failed' THEN $3 ELSE "content" END WHERE "id" = $1`,
          [job.message_id, retry ? 'pending' : 'failed', audioFailedContent],
        )
      } else if (!retry) {
        await manager.query(
          `UPDATE "bo"."leads" SET "conversation_status" = 'awaiting_human', "updated_at" = now() WHERE "id" = $1`,
          [job.lead_id],
        )
      }
    })
    console.error(`Audio processing failed messageId=${job.message_id} retry=${retry}`, error)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

export function startLeadAudioWorker() {
  if (!leadConfig.audioEnabled) return async () => undefined
  let stopped = false
  let timer: NodeJS.Timeout | undefined
  let active: Promise<void> | undefined
  const tick = async () => {
    try {
      const jobs = await Promise.all(
        Array.from({ length: Math.max(1, leadConfig.audioConcurrency) }, () => claimAudioJob()),
      )
      await Promise.all(jobs.filter((job): job is AudioJob => Boolean(job)).map(processAudioJob))
    } catch (error) {
      console.error('Lead audio worker tick failed', error)
    } finally {
      if (!stopped)
        timer = setTimeout(() => {
          active = tick()
        }, leadConfig.audioPollMs)
    }
  }
  active = tick()
  return async () => {
    stopped = true
    if (timer) clearTimeout(timer)
    await active
  }
}
