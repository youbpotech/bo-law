import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { Company } from './Company'

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

  @Column({ type: 'varchar', length: 255, select: false })
  password!: string

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
}
