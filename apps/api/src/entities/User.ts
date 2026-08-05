import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm'
import { Company } from './Company'
import { UserNotificationChannel } from './UserNotificationChannel'
import { LegalCaseStakeholder } from './LegalCaseStakeholder'

@Entity({ name: 'users', schema: 'bo' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 255 })
  name!: string

  @Column({ type: 'varchar', length: 100, unique: true })
  username!: string

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  email!: string | null

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone!: string | null

  @Column({ type: 'varchar', length: 255, select: false, nullable: true })
  password!: string | null

  @Column({ name: 'keycloak_id', type: 'uuid', unique: true, nullable: true })
  keycloakId!: string | null

  @Column({ name: 'company_id', type: 'integer' })
  companyId!: number

  @Column({ type: 'boolean', default: false })
  root!: boolean

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date

  @ManyToOne(() => Company, (company) => company.users, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company

  @OneToMany(() => UserNotificationChannel, (preference) => preference.user)
  notificationChannelPreferences!: UserNotificationChannel[]

  @OneToMany(() => LegalCaseStakeholder, (stakeholder) => stakeholder.user)
  caseStakeholdings!: LegalCaseStakeholder[]

  permissions?: string[]
  roleRoot?: boolean
}
