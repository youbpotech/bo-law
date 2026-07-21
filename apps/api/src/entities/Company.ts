import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { Client } from './Client'
import { LegalCase } from './LegalCase'
import { Lead } from './Lead'
import { User } from './User'

export const DEFAULT_DASHBOARD_WIDGETS = [
  'totalLeads',
  'hotLeads',
  'pendingInterviews',
  'activeCases',
  'pendingDocuments',
  'outstandingAmount',
] as const

export type DashboardWidgetKey =
  | (typeof DEFAULT_DASHBOARD_WIDGETS)[number]
  | 'receivedAmount'
  | 'rehydrationsDue'

export type DashboardConfig = {
  widgets: DashboardWidgetKey[]
}

export const COMPANY_THEMES = ['default', 'pati-lemos', 'asap', 'me-associados'] as const
export type CompanyTheme = (typeof COMPANY_THEMES)[number]

@Entity({ name: 'companies', schema: 'bo' })
export class Company {
  @PrimaryGeneratedColumn('identity')
  id!: number

  @Column({ type: 'varchar', length: 255 })
  name!: string

  @Column({ type: 'varchar', length: 50, default: 'default' })
  theme!: CompanyTheme

  @Column({ name: 'logomarca', type: 'bytea', nullable: true, select: false })
  logo!: Buffer | null

  @Column({ name: 'logomarca_mime_type', type: 'varchar', length: 30, nullable: true })
  logoMimeType!: string | null

  @Column({ name: 'whatsapp_number', type: 'varchar', length: 40, nullable: true })
  whatsappNumber!: string | null

  @Column({
    name: 'dashboard_config',
    type: 'jsonb',
    default: () => `'${JSON.stringify({ widgets: DEFAULT_DASHBOARD_WIDGETS })}'::jsonb`,
  })
  dashboardConfig!: DashboardConfig

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date

  @OneToMany(() => User, (user) => user.company)
  users!: User[]

  @OneToMany(() => Client, (client) => client.company)
  clients!: Client[]

  @OneToMany(() => Lead, (lead) => lead.company)
  leads!: Lead[]

  @OneToMany(() => LegalCase, (legalCase) => legalCase.company)
  legalCases!: LegalCase[]
}
