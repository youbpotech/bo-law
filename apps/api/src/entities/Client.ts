import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { Company } from './Company'
import { Lead } from './Lead'
import { LegalCase } from './LegalCase'

@Entity({ name: 'clients', schema: 'bo' })
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 255 })
  name!: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone!: string | null

  @Column({ name: 'company_id', type: 'integer' })
  companyId!: number

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date

  @ManyToOne(() => Company, (company) => company.clients, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company

  @OneToMany(() => Lead, (lead) => lead.client)
  leads!: Lead[]

  @OneToMany(() => LegalCase, (legalCase) => legalCase.client)
  legalCases!: LegalCase[]
}
