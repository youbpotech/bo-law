import { config as loadEnv } from 'dotenv'

loadEnv()

export const leadConfig = {
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
  openaiTranscriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL ?? 'gpt-4o-mini-transcribe',
  llmTimeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 10_000),
  audioEnabled: process.env.AUDIO_TRANSCRIPTION_ENABLED !== 'false',
  audioLanguage: process.env.AUDIO_TRANSCRIPTION_LANGUAGE ?? 'pt',
  audioMaxBytes: Number(process.env.AUDIO_MAX_BYTES ?? 20 * 1024 * 1024),
  audioTimeoutMs: Number(process.env.AUDIO_TRANSCRIPTION_TIMEOUT_MS ?? 60_000),
  audioMaxAttempts: Number(process.env.AUDIO_MAX_ATTEMPTS ?? 5),
  audioConcurrency: Number(process.env.AUDIO_WORKER_CONCURRENCY ?? 2),
  audioPollMs: Number(process.env.AUDIO_WORKER_POLL_MS ?? 3_000),
  audioLeaseMs: Number(process.env.AUDIO_WORKER_LEASE_MS ?? 15 * 60 * 1_000),
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? '',
  twilioWhatsappFrom: process.env.TWILIO_WHATSAPP_FROM ?? '',
  publicBackendUrl: (process.env.PUBLIC_BACKEND_URL ?? 'http://localhost:3001').replace(/\/$/, ''),
  validateTwilioSignature: process.env.VALIDATE_TWILIO_SIGNATURE !== 'false',
}
