import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCompanyLogo1784764800000 implements MigrationInterface {
  name = 'AddCompanyLogo1784764800000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bo"."companies" ADD COLUMN IF NOT EXISTS "logomarca" bytea`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."companies" ADD COLUMN IF NOT EXISTS "logomarca_mime_type" varchar(30)`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bo"."companies" DROP COLUMN IF EXISTS "logomarca_mime_type"`,
    )
    await queryRunner.query(`ALTER TABLE "bo"."companies" DROP COLUMN IF EXISTS "logomarca"`)
  }
}
