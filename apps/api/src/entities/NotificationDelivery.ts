import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { Notification, type NotificationChannel } from './Notification'

export type NotificationDeliveryStatus = 'pending' | 'processing' | 'sent' | 'failed'

@Entity({ name: 'notification_deliveries', schema: 'bo' })
export class NotificationDelivery {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'notification_id', type: 'uuid' })
  notificationId!: string

  @Column({ type: 'varchar', length: 20 })
  channel!: NotificationChannel

  @Column({ type: 'varchar', length: 320 })
  recipient!: string

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: NotificationDeliveryStatus

  @Column({ type: 'integer', default: 0 })
  attempts!: number

  @Column({ name: 'provider_message_id', type: 'varchar', length: 255, nullable: true })
  providerMessageId!: string | null

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null

  @Column({ name: 'next_attempt_at', type: 'timestamptz', default: () => 'now()' })
  nextAttemptAt!: Date

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt!: Date | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date

  @ManyToOne(() => Notification, (notification) => notification.deliveries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'notification_id' })
  notification!: Notification
}
