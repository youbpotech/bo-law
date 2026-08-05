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

  @Column({ name: 'nome', type: 'varchar', length: 200 })
  name!: string

  @Column({ name: 'apelido', type: 'varchar', length: 200, nullable: true })
  surname!: string | null

  @Column({ name: 'nif_pt', type: 'varchar', length: 20, nullable: true })
  portugueseTaxId!: string | null

  @Column({ name: 'niss', type: 'varchar', length: 11, nullable: true })
  niss!: string | null

  @Column({ name: 'numero_utente_sns', type: 'varchar', length: 9, nullable: true })
  snsUserNumber!: string | null

  @Column({ name: 'numero_ar', type: 'varchar', length: 9, nullable: true })
  arNumber!: string | null

  @Column({ name: 'numero_cartao_cidadao', type: 'varchar', length: 12, nullable: true })
  citizenCardNumber!: string | null

  @Column({ name: 'identificacao_fiscal_estrangeira', type: 'varchar', length: 20, nullable: true })
  foreignTaxId!: string | null

  @Column({
    name: 'chave_estrangeira_tipo_identificacao_fiscal',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  foreignTaxIdType!: string | null

  @Column({ name: 'data_nascimento', type: 'date', nullable: true })
  birthDate!: string | null

  @Column({ name: 'sexo', type: 'varchar', length: 20, nullable: true })
  sex!: string | null

  @Column({ name: 'estado_civil', type: 'varchar', length: 20, nullable: true })
  maritalStatus!: string | null

  @Column({ name: 'nome_progenitor_1', type: 'varchar', length: 200, nullable: true })
  parent1Name!: string | null

  @Column({ name: 'apelido_progenitor_1', type: 'varchar', length: 200, nullable: true })
  parent1Surname!: string | null

  @Column({ name: 'nome_progenitor_2', type: 'varchar', length: 200, nullable: true })
  parent2Name!: string | null

  @Column({ name: 'apelido_progenitor_2', type: 'varchar', length: 200, nullable: true })
  parent2Surname!: string | null

  @Column({ name: 'pais_nacionalidade', type: 'varchar', length: 10, nullable: true })
  nationalityCountry!: string | null

  @Column({ name: 'pais_naturalidade', type: 'varchar', length: 10, nullable: true })
  birthCountry!: string | null

  @Column({ name: 'provincia_departamento', type: 'varchar', length: 200, nullable: true })
  birthProvince!: string | null

  @Column({ name: 'codigo_provincia', type: 'varchar', length: 50, nullable: true })
  birthProvinceCode!: string | null

  @Column({ name: 'local_nascimento', type: 'varchar', length: 200, nullable: true })
  birthPlace!: string | null

  @Column({ name: 'distrito_naturalidade', type: 'integer', nullable: true })
  birthDistrictId!: number | null

  @Column({ name: 'concelho_naturalidade', type: 'integer', nullable: true })
  birthMunicipalityId!: number | null

  @Column({ name: 'freguesia_naturalidade', type: 'integer', nullable: true })
  birthParishId!: number | null

  @Column({ name: 'tipo_documento_civil', type: 'varchar', length: 30, nullable: true })
  civilDocumentType!: string | null

  @Column({ name: 'numero_documento_civil', type: 'varchar', length: 100, nullable: true })
  civilDocumentNumber!: string | null

  @Column({ name: 'data_validade_documento_civil', type: 'date', nullable: true })
  civilDocumentExpiryDate!: string | null

  @Column({ type: 'varchar', length: 320, nullable: true })
  email!: string | null

  @Column({ name: 'indicativo_telemovel', type: 'varchar', length: 10, nullable: true })
  mobileCountryCode!: string | null

  @Column({ name: 'telemovel', type: 'varchar', length: 30, nullable: true })
  mobile!: string | null

  @Column({ name: 'indicativo_telefone', type: 'varchar', length: 10, nullable: true })
  phoneCountryCode!: string | null

  @Column({ name: 'telefone', type: 'varchar', length: 30, nullable: true })
  phone!: string | null

  @Column({ name: 'pais_residencia', type: 'varchar', length: 10, nullable: true })
  residenceCountry!: string | null

  @Column({ name: 'morada_residencia', type: 'varchar', length: 500, nullable: true })
  residenceAddress!: string | null

  @Column({ name: 'localidade_residencia', type: 'varchar', length: 200, nullable: true })
  residenceLocality!: string | null

  @Column({ name: 'codigo_postal_residencia', type: 'varchar', length: 30, nullable: true })
  residencePostalCode!: string | null

  @Column({ name: 'localidade_postal', type: 'varchar', length: 200, nullable: true })
  residencePostalLocality!: string | null

  @Column({ name: 'distrito_residencia', type: 'integer', nullable: true })
  residenceDistrictId!: number | null

  @Column({ name: 'concelho_residencia', type: 'integer', nullable: true })
  residenceMunicipalityId!: number | null

  @Column({ name: 'freguesia_residencia', type: 'integer', nullable: true })
  residenceParishId!: number | null

  @Column({ name: 'endereco_estrangeiro', type: 'varchar', length: 500, nullable: true })
  foreignAddress!: string | null

  @Column({ name: 'endereco_estrangeiro_1', type: 'varchar', length: 500, nullable: true })
  foreignAddress1!: string | null

  @Column({ name: 'endereco_estrangeiro_2', type: 'varchar', length: 500, nullable: true })
  foreignAddress2!: string | null

  @Column({ name: 'cidade_estrangeiro', type: 'varchar', length: 200, nullable: true })
  foreignCity!: string | null

  @Column({ name: 'regiao_estrangeiro', type: 'varchar', length: 200, nullable: true })
  foreignRegion!: string | null

  @Column({ name: 'codigo_postal_estrangeiro', type: 'varchar', length: 30, nullable: true })
  foreignPostalCode!: string | null

  @Column({ name: 'company_id', type: 'integer' })
  companyId!: number

  @CreateDateColumn({ name: 'criado_em' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'atualizado_em' })
  updatedAt!: Date

  @ManyToOne(() => Company, (company) => company.clients, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company

  @OneToMany(() => Lead, (lead) => lead.client)
  leads!: Lead[]

  @OneToMany(() => LegalCase, (legalCase) => legalCase.client)
  legalCases!: LegalCase[]
}
