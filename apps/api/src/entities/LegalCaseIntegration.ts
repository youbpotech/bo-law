import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { LegalCase } from './LegalCase'

export type LegalCaseIntegrationProvider = 'botniss' | 'botaima'
export type LegalCaseIntegrationState =
  | 'pending'
  | 'processing'
  | 'active'
  | 'failed'
  | 'completed'

@Entity({ name: 'legal_case_integrations', schema: 'bo' })
export class LegalCaseIntegration {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'legal_case_id', type: 'uuid' })
  legalCaseId!: string

  @Column({ type: 'varchar', length: 50 })
  provider!: LegalCaseIntegrationProvider

  @Column({ name: 'external_process_id', type: 'varchar', length: 255, nullable: true })
  externalProcessId!: string | null

  @Column({ name: 'external_reference', type: 'varchar', length: 500 })
  externalReference!: string

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status!: LegalCaseIntegrationState

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null

  @Column({ name: 'processing_token', type: 'uuid', nullable: true })
  processingToken!: string | null

  @Column({ name: 'processing_started_at', type: 'timestamptz', nullable: true })
  processingStartedAt!: Date | null

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date

  @ManyToOne(() => LegalCase, (legalCase) => legalCase.integrations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'legal_case_id' })
  legalCase!: LegalCase
}
