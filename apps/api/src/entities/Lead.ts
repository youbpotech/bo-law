import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { Client } from './Client'
import { Company } from './Company'
import { LeadMessage } from './LeadMessage'
import { LegalCase } from './LegalCase'

export type QualificationLevel = 'frio' | 'morno' | 'quente'
export type ConversationStatus = 'bot_active' | 'awaiting_human' | 'human_active'
export type LeadSourceChannel = 'partners' | 'lives' | 'referrals' | 'website' | 'other'
export type LeadUrgency = 'low' | 'medium' | 'high'
export type LeadSalesStage =
  | 'new'
  | 'interview_scheduled'
  | 'interview_completed'
  | 'nurturing'
  | 'contracted'
  | 'lost'

@Entity({ name: 'leads', schema: 'bo' })
@Index('UQ_bo_leads_company_phone', ['companyId', 'phone'], { unique: true })
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'company_id', type: 'integer' })
  companyId!: number

  @Column({ name: 'client_id', type: 'uuid', nullable: true })
  clientId!: string | null

  @Column({ type: 'text' })
  phone!: string

  @Column({ type: 'text', nullable: true })
  email!: string | null

  @Column({ type: 'text', nullable: true })
  name!: string | null

  @Column({ name: 'source_channel', type: 'text', default: 'other' })
  sourceChannel!: LeadSourceChannel

  @Column({ name: 'legal_area', type: 'text', nullable: true })
  legalArea!: string | null

  @Column({ name: 'service_type', type: 'text', nullable: true })
  serviceType!: string | null

  @Column({ name: 'case_summary', type: 'text', nullable: true })
  caseSummary!: string | null

  @Column({ type: 'text', nullable: true })
  jurisdiction!: string | null

  @Column({ type: 'text', nullable: true })
  urgency!: LeadUrgency | null

  @Column({ type: 'text', nullable: true })
  deadline!: string | null

  @Column({ name: 'fee_budget', type: 'numeric', precision: 12, scale: 2, nullable: true })
  feeBudget!: number | null

  @Column({ name: 'payment_capacity', type: 'text', nullable: true })
  paymentCapacity!: string | null

  @Column({ name: 'document_readiness', type: 'text', nullable: true })
  documentReadiness!: string | null

  @Column({ name: 'requested_human_help', type: 'boolean', default: false })
  requestedHumanHelp!: boolean

  @Column({ name: 'qualification_score', type: 'integer', default: 0 })
  qualificationScore!: number

  @Column({ name: 'qualification_level', type: 'text', default: 'frio' })
  qualificationLevel!: QualificationLevel

  @Column({ name: 'conversation_status', type: 'text', default: 'bot_active' })
  conversationStatus!: ConversationStatus

  @Column({ name: 'sales_stage', type: 'text', default: 'new' })
  salesStage!: LeadSalesStage

  @Column({ name: 'interview_at', type: 'timestamptz', nullable: true })
  interviewAt!: Date | null

  @Column({ name: 'rehydrate_at', type: 'timestamptz', nullable: true })
  rehydrateAt!: Date | null

  @Column({ name: 'last_message', type: 'text', nullable: true })
  lastMessage!: string | null

  @Column({ name: 'last_message_at', type: 'timestamptz', nullable: true })
  lastMessageAt!: Date | null

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  profile!: Record<string, unknown>

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date

  @ManyToOne(() => Company, (company) => company.leads, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company

  @ManyToOne(() => Client, (client) => client.leads, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'client_id' })
  client!: Client | null

  @OneToMany(() => LeadMessage, (message) => message.lead)
  messages!: LeadMessage[]

  @OneToOne(() => LegalCase, (legalCase) => legalCase.lead)
  legalCase!: LegalCase | null
}
