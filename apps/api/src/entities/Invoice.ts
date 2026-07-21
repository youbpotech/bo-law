import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { LegalCase } from './LegalCase'

export type InvoiceKind = 'partial' | 'final'
export type InvoiceStatus = 'requested' | 'issued' | 'paid'

@Entity({ name: 'invoices', schema: 'bo' })
@Index('UQ_bo_invoices_case_kind', ['legalCaseId', 'kind'], { unique: true })
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'legal_case_id', type: 'uuid' })
  legalCaseId!: string

  @Column({ type: 'text' })
  kind!: InvoiceKind

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  percentage!: number

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount!: number

  @Column({ type: 'text', default: 'requested' })
  status!: InvoiceStatus

  @Column({ name: 'due_at', type: 'timestamptz', nullable: true })
  dueAt!: Date | null

  @Column({ name: 'issued_at', type: 'timestamptz', nullable: true })
  issuedAt!: Date | null

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt!: Date | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date

  @ManyToOne(() => LegalCase, (legalCase) => legalCase.invoices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'legal_case_id' })
  legalCase!: LegalCase
}
