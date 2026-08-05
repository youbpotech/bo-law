import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, Column } from 'typeorm'
import { LegalCase } from './LegalCase'
import { User } from './User'

export type LegalCaseStakeholderRole = 'creator' | 'stakeholder'

@Entity({ name: 'legal_case_stakeholders', schema: 'bo' })
export class LegalCaseStakeholder {
  @PrimaryColumn({ name: 'legal_case_id', type: 'uuid' })
  legalCaseId!: string

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string

  @Column({ type: 'varchar', length: 20 })
  role!: LegalCaseStakeholderRole

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @ManyToOne(() => LegalCase, (legalCase) => legalCase.stakeholders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'legal_case_id' })
  legalCase!: LegalCase

  @ManyToOne(() => User, (user) => user.caseStakeholdings, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user!: User
}
