import { MigrationInterface, QueryRunner } from 'typeorm'

export class HardenLegalCaseIntegrationClaims1785888000000 implements MigrationInterface {
  name = 'HardenLegalCaseIntegrationClaims1785888000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bo"."legal_case_integrations" ADD COLUMN IF NOT EXISTS "processing_token" uuid`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."legal_case_integrations" ADD COLUMN IF NOT EXISTS "processing_started_at" timestamptz`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."legal_case_integrations" DROP CONSTRAINT IF EXISTS "CK_bo_legal_case_integrations_status"`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."legal_case_integrations" ADD CONSTRAINT "CK_bo_legal_case_integrations_status" CHECK ("status" IN ('pending', 'processing', 'active', 'failed', 'completed'))`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."legal_case_integrations" DROP CONSTRAINT IF EXISTS "CK_bo_legal_case_integrations_provider"`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."legal_case_integrations" ADD CONSTRAINT "CK_bo_legal_case_integrations_provider" CHECK ("provider" IN ('botniss', 'botaima'))`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."legal_cases" DROP CONSTRAINT IF EXISTS "CK_bo_legal_cases_type"`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."legal_cases" ADD CONSTRAINT "CK_bo_legal_cases_type" CHECK ("case_type" IN ('general', 'niss', 'aima'))`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_bo_legal_case_stakeholders_creator" ON "bo"."legal_case_stakeholders" ("legal_case_id") WHERE "role" = 'creator'`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "bo"."UQ_bo_legal_case_stakeholders_creator"`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."legal_cases" DROP CONSTRAINT IF EXISTS "CK_bo_legal_cases_type"`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."legal_case_integrations" DROP CONSTRAINT IF EXISTS "CK_bo_legal_case_integrations_provider"`,
    )
    await queryRunner.query(
      `UPDATE "bo"."legal_case_integrations" SET "status" = 'pending' WHERE "status" = 'processing'`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."legal_case_integrations" DROP CONSTRAINT IF EXISTS "CK_bo_legal_case_integrations_status"`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."legal_case_integrations" ADD CONSTRAINT "CK_bo_legal_case_integrations_status" CHECK ("status" IN ('pending', 'active', 'failed', 'completed'))`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."legal_case_integrations" DROP COLUMN IF EXISTS "processing_started_at"`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."legal_case_integrations" DROP COLUMN IF EXISTS "processing_token"`,
    )
  }
}
