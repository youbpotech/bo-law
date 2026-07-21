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

  @Column({ type: 'varchar', length: 255 })
  title!: string

  @Column({ name: 'service_type', type: 'text' })
  serviceType!: string

  @Column({ type: 'text', nullable: true })
  description!: string | null

  @Column({ name: 'contracted_fee', type: 'numeric', precision: 12, scale: 2 })
  contractedFee!: number

  @Column({ type: 'text', default: 'awaiting_initial_payment' })
  stage!: LegalCaseStage

  @Column({ name: 'documents_complete', type: 'boolean', default: false })
  documentsComplete!: boolean

  @Column({ name: 'contract_signed_at', type: 'timestamptz' })
  contractSignedAt!: Date

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

  @OneToMany(() => Invoice, (invoice) => invoice.legalCase, { cascade: ['insert'] })
  invoices!: Invoice[]
}
