import { MigrationInterface, QueryRunner } from 'typeorm'

export class EnforceLegalCaseCreator1785974400000 implements MigrationInterface {
  name = 'EnforceLegalCaseCreator1785974400000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
            FROM "bo"."legal_cases"
           WHERE "created_by_user_id" IS NULL
        ) THEN
          RAISE EXCEPTION 'Atualize diretamente os LegalCases sem criador antes de aplicar esta migração.';
        END IF;
      END
      $$
    `)
    await queryRunner.query(
      `ALTER TABLE "bo"."legal_cases" ALTER COLUMN "created_by_user_id" SET NOT NULL`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."legal_cases" DROP CONSTRAINT IF EXISTS "FK_bo_legal_cases_created_by"`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."legal_cases" ADD CONSTRAINT "FK_bo_legal_cases_created_by" FOREIGN KEY ("created_by_user_id") REFERENCES "bo"."users"("id") ON DELETE RESTRICT`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bo"."legal_cases" DROP CONSTRAINT IF EXISTS "FK_bo_legal_cases_created_by"`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."legal_cases" ADD CONSTRAINT "FK_bo_legal_cases_created_by" FOREIGN KEY ("created_by_user_id") REFERENCES "bo"."users"("id") ON DELETE SET NULL`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."legal_cases" ALTER COLUMN "created_by_user_id" DROP NOT NULL`,
    )
  }
}
