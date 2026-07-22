import { MigrationInterface, QueryRunner } from 'typeorm'

const OPTIONAL_COLUMNS = [
  ['apelido', 'varchar(200)'],
  ['nif_pt', 'varchar(20)'],
  ['identificacao_fiscal_estrangeira', 'varchar(20)'],
  ['chave_estrangeira_tipo_identificacao_fiscal', 'varchar(50)'],
  ['data_nascimento', 'date'],
  ['sexo', 'varchar(20)'],
  ['estado_civil', 'varchar(20)'],
  ['nome_progenitor_1', 'varchar(200)'],
  ['apelido_progenitor_1', 'varchar(200)'],
  ['nome_progenitor_2', 'varchar(200)'],
  ['apelido_progenitor_2', 'varchar(200)'],
  ['pais_nacionalidade', 'varchar(10)'],
  ['pais_naturalidade', 'varchar(10)'],
  ['provincia_departamento', 'varchar(200)'],
  ['codigo_provincia', 'varchar(50)'],
  ['local_nascimento', 'varchar(200)'],
  ['distrito_naturalidade', 'integer'],
  ['concelho_naturalidade', 'integer'],
  ['freguesia_naturalidade', 'integer'],
  ['tipo_documento_civil', 'varchar(30)'],
  ['numero_documento_civil', 'varchar(100)'],
  ['data_validade_documento_civil', 'date'],
  ['indicativo_telemovel', 'varchar(10)'],
  ['telemovel', 'varchar(30)'],
  ['indicativo_telefone', 'varchar(10)'],
  ['pais_residencia', 'varchar(10)'],
  ['morada_residencia', 'varchar(500)'],
  ['localidade_residencia', 'varchar(200)'],
  ['codigo_postal_residencia', 'varchar(30)'],
  ['localidade_postal', 'varchar(200)'],
  ['distrito_residencia', 'integer'],
  ['concelho_residencia', 'integer'],
  ['freguesia_residencia', 'integer'],
  ['endereco_estrangeiro', 'varchar(500)'],
  ['endereco_estrangeiro_1', 'varchar(500)'],
  ['endereco_estrangeiro_2', 'varchar(500)'],
  ['cidade_estrangeiro', 'varchar(200)'],
  ['regiao_estrangeiro', 'varchar(200)'],
  ['codigo_postal_estrangeiro', 'varchar(30)'],
] as const

export class ExpandClientProfile1784851200000 implements MigrationInterface {
  name = 'ExpandClientProfile1784851200000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bo"."clients" RENAME COLUMN "name" TO "nome"`)
    await queryRunner.query(`ALTER TABLE "bo"."clients" RENAME COLUMN "phone" TO "telefone"`)
    await queryRunner.query(`ALTER TABLE "bo"."clients" RENAME COLUMN "created_at" TO "criado_em"`)
    await queryRunner.query(`ALTER TABLE "bo"."clients" RENAME COLUMN "updated_at" TO "atualizado_em"`)
    await queryRunner.query(`ALTER TABLE "bo"."clients" ALTER COLUMN "nome" TYPE varchar(200)`)
    await queryRunner.query(`ALTER TABLE "bo"."clients" ALTER COLUMN "email" TYPE varchar(320)`)
    await queryRunner.query(`ALTER TABLE "bo"."clients" ALTER COLUMN "telefone" TYPE varchar(30)`)
    for (const [column, type] of OPTIONAL_COLUMNS) {
      await queryRunner.query(
        `ALTER TABLE "bo"."clients" ADD COLUMN IF NOT EXISTS "${column}" ${type}`,
      )
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [column] of [...OPTIONAL_COLUMNS].reverse()) {
      await queryRunner.query(`ALTER TABLE "bo"."clients" DROP COLUMN IF EXISTS "${column}"`)
    }
    await queryRunner.query(`ALTER TABLE "bo"."clients" ALTER COLUMN "telefone" TYPE varchar(40)`)
    await queryRunner.query(`ALTER TABLE "bo"."clients" ALTER COLUMN "email" TYPE varchar(255)`)
    await queryRunner.query(`ALTER TABLE "bo"."clients" ALTER COLUMN "nome" TYPE varchar(255)`)
    await queryRunner.query(`ALTER TABLE "bo"."clients" RENAME COLUMN "atualizado_em" TO "updated_at"`)
    await queryRunner.query(`ALTER TABLE "bo"."clients" RENAME COLUMN "criado_em" TO "created_at"`)
    await queryRunner.query(`ALTER TABLE "bo"."clients" RENAME COLUMN "telefone" TO "phone"`)
    await queryRunner.query(`ALTER TABLE "bo"."clients" RENAME COLUMN "nome" TO "name"`)
  }
}
