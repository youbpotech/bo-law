import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { Company } from './Company'
import { NotificationDelivery } from './NotificationDelivery'
import { User } from './User'
import { LegalCase } from './LegalCase'

export const NOTIFICATION_CHANNELS = ['internal', 'email', 'whatsapp', 'sms'] as const
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]
export type NotificationStatus = 'pending' | 'sent' | 'partial' | 'failed'

@Entity({ name: 'notifications', schema: 'bo' })
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'company_id', type: 'integer' })
  companyId!: number

  @Column({ name: 'recipient_user_id', type: 'uuid', nullable: true })
  recipientUserId!: string | null

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId!: string | null

  @Column({ name: 'legal_case_id', type: 'uuid', nullable: true })
  legalCaseId!: string | null

  @Column({ name: 'event_type', type: 'varchar', length: 100, nullable: true })
  eventType!: string | null

  @Column({ name: 'idempotency_key', type: 'varchar', length: 255, nullable: true })
  idempotencyKey!: string | null

  @Column({ type: 'varchar', length: 255 })
  title!: string

  @Column({ type: 'text' })
  body!: string

  @Column({ type: 'text', array: true })
  channels!: NotificationChannel[]

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: NotificationStatus

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt!: Date | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company!: Company

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipient_user_id' })
  recipientUser!: User | null

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser!: User | null

  @ManyToOne(() => LegalCase, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'legal_case_id' })
  legalCase!: LegalCase | null

  @OneToMany(() => NotificationDelivery, (delivery) => delivery.notification)
  deliveries!: NotificationDelivery[]
}
