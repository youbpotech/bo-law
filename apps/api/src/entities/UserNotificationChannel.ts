import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm'
import { type NotificationChannel } from './Notification'
import { User } from './User'

@Entity({ name: 'user_notification_channels', schema: 'bo' })
export class UserNotificationChannel {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string

  @PrimaryColumn({ type: 'varchar', length: 20 })
  channel!: NotificationChannel

  @Column({ type: 'boolean', default: false })
  enabled!: boolean

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date

  @ManyToOne(() => User, (user) => user.notificationChannelPreferences, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User
}
