import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { LeadMessage } from './LeadMessage'

@Entity({ name: 'lead_audio_processing', schema: 'bo' })
export class LeadAudioProcessing {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'message_id', type: 'uuid', unique: true })
  messageId!: string

  @Column({ name: 'twilio_media_sid', type: 'text', unique: true })
  twilioMediaSid!: string

  @Column({ name: 'whatsapp_from', type: 'text', nullable: true })
  whatsappFrom!: string | null

  @Column({ name: 'content_type', type: 'text' })
  contentType!: string

  @Column({ name: 'byte_size', type: 'bigint', nullable: true })
  byteSize!: number | null

  @Column({ name: 'duration_seconds', type: 'numeric', nullable: true })
  durationSeconds!: number | null

  @Column({ name: 'transcription_provider', type: 'text', nullable: true })
  transcriptionProvider!: string | null

  @Column({ name: 'transcription_model', type: 'text', nullable: true })
  transcriptionModel!: string | null

  @Column({ type: 'text', nullable: true })
  language!: string | null

  @Column({ name: 'attempt_count', type: 'integer', default: 0 })
  attemptCount!: number

  @Column({ name: 'next_attempt_at', type: 'timestamptz', nullable: true, default: () => 'now()' })
  nextAttemptAt!: Date | null

  @Column({ name: 'last_error_code', type: 'text', nullable: true })
  lastErrorCode!: string | null

  @Column({ name: 'last_error_message', type: 'text', nullable: true })
  lastErrorMessage!: string | null

  @Column({ name: 'twilio_media_deleted_at', type: 'timestamptz', nullable: true })
  twilioMediaDeletedAt!: Date | null

  @Column({ name: 'transcribed_at', type: 'timestamptz', nullable: true })
  transcribedAt!: Date | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date

  @OneToOne(() => LeadMessage, (message) => message.audioProcessing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message!: LeadMessage
}
