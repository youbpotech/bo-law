import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { Client } from './Client'
import { Company } from './Company'
import { Invoice } from './Invoice'
import { Lead } from './Lead'
import { User } from './User'
import { LegalCaseStakeholder } from './LegalCaseStakeholder'
import { LegalCaseIntegration } from './LegalCaseIntegration'
import { ServiceType } from './ServiceType'

export type LegalCaseType = 'general' | 'niss' | 'aima'
export type LegalCaseIntegrationStatus =
  | 'not_applicable'
  | 'pending'
  | 'active'
  | 'failed'
  | 'completed'

export type LegalCaseStage =
  | 'awaiting_initial_payment'
  | 'document_collection'
  | 'public_services_scheduling'
  | 'diligences'
  | 'awaiting_documents'
  | 'final_artifacts'
  | 'client_final_delivery'
  | 'awaiting_final_payment'
  | 'closed'

@Entity({ name: 'legal_cases', schema: 'bo' })
export class LegalCase {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'company_id', type: 'integer' })
  companyId!: number

  @Column({ name: 'client_id', type: 'uuid' })
  clientId!: string

  @Column({ name: 'lead_id', type: 'uuid', nullable: true, unique: true })
  leadId!: string | null

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId!: string

  @Column({ name: 'service_id', type: 'uuid' })
  serviceId!: string

  @Column({ name: 'case_type', type: 'varchar', length: 50, default: 'general' })
  caseType!: LegalCaseType

  @Column({ name: 'integration_status', type: 'varchar', length: 30, default: 'not_applicable' })
  integrationStatus!: LegalCaseIntegrationStatus

  @Column({ type: 'varchar', length: 255 })
  title!: string

  @Column({ type: 'text', nullable: true })
  description!: string | null

  @Column({ name: 'contracted_fee', type: 'numeric', precision: 12, scale: 2, nullable: true })
  contractedFee!: number | null

  @Column({ type: 'text', default: 'awaiting_initial_payment' })
  stage!: LegalCaseStage

  @Column({ name: 'documents_complete', type: 'boolean', default: false })
  documentsComplete!: boolean

  @Column({ name: 'contract_signed_at', type: 'timestamptz', nullable: true })
  contractSignedAt!: Date | null

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date

  @ManyToOne(() => Company, (company) => company.legalCases, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company

  @ManyToOne(() => Client, (client) => client.legalCases, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'client_id' })
  client!: Client

  @OneToOne(() => Lead, (lead) => lead.legalCase, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'lead_id' })
  lead!: Lead | null

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser!: User

  @ManyToOne(() => ServiceType, (service) => service.legalCases, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'service_id' })
  service!: ServiceType

  @OneToMany(() => LegalCaseStakeholder, (stakeholder) => stakeholder.legalCase)
  stakeholders!: LegalCaseStakeholder[]

  @OneToMany(() => LegalCaseIntegration, (integration) => integration.legalCase)
  integrations!: LegalCaseIntegration[]

  @OneToMany(() => Invoice, (invoice) => invoice.legalCase, { cascade: ['insert'] })
  invoices!: Invoice[]
}
