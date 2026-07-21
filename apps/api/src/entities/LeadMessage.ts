import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'
import { Lead } from './Lead'
import { LeadAudioProcessing } from './LeadAudioProcessing'

export type MessageDirection = 'inbound' | 'outbound'
export type MessageSender = 'lead' | 'bot' | 'human'
export type MessageType = 'text' | 'audio'
export type MessageProcessingStatus =
  | 'pending'
  | 'downloading'
  | 'converting'
  | 'transcribing'
  | 'ready'
  | 'failed'

@Entity({ name: 'lead_messages', schema: 'bo' })
export class LeadMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'lead_id', type: 'uuid' })
  leadId!: string

  @Column({ type: 'text' })
  direction!: MessageDirection

  @Column({ name: 'sender_type', type: 'text' })
  senderType!: MessageSender

  @Column({ name: 'twilio_message_sid', type: 'text', nullable: true })
  twilioMessageSid!: string | null

  @Column({ name: 'in_reply_to_message_id', type: 'uuid', nullable: true })
  inReplyToMessageId!: string | null

  @Column({ name: 'message_type', type: 'text', default: 'text' })
  messageType!: MessageType

  @Column({ name: 'processing_status', type: 'text', default: 'ready' })
  processingStatus!: MessageProcessingStatus

  @Column({ name: 'bot_processing_started_at', type: 'timestamptz', nullable: true })
  botProcessingStartedAt!: Date | null

  @Column({ name: 'bot_processed_at', type: 'timestamptz', nullable: true })
  botProcessedAt!: Date | null

  @Column({ name: 'source_content_type', type: 'text', nullable: true })
  sourceContentType!: string | null

  @Column({ type: 'text' })
  content!: string

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @ManyToOne(() => Lead, (lead) => lead.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_id' })
  lead!: Lead

  @OneToOne(() => LeadAudioProcessing, (audio) => audio.message)
  audioProcessing!: LeadAudioProcessing | null
}
