import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { Company } from './Company'
import { LegalCase } from './LegalCase'

export const SERVICE_PROCESS_TYPES = ['general', 'niss', 'aima'] as const
export type ServiceProcessType = (typeof SERVICE_PROCESS_TYPES)[number]

@Entity({ name: 'service_types', schema: 'bo' })
export class ServiceType {
  @PrimaryGeneratedColumn('uuid') id!: string
  @Column({ name: 'company_id', type: 'integer' }) companyId!: number
  @Column({ type: 'varchar', length: 80 }) code!: string
  @Column({ type: 'varchar', length: 255 }) name!: string
  @Column({ name: 'process_type', type: 'varchar', length: 20, default: 'general' }) processType!: ServiceProcessType
  @Column({ type: 'text', nullable: true }) description!: string | null
  @Column({ type: 'boolean', default: true }) active!: boolean
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date
  @ManyToOne(() => Company, (company) => company.serviceTypes, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'company_id' }) company!: Company
  @OneToMany(() => LegalCase, (legalCase) => legalCase.service) legalCases!: LegalCase[]
}
