import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCompanyFavicon1785024000000 implements MigrationInterface {
  name = 'AddCompanyFavicon1785024000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bo"."companies" ADD COLUMN IF NOT EXISTS "favicon" bytea`)
    await queryRunner.query(
      `ALTER TABLE "bo"."companies" ADD COLUMN IF NOT EXISTS "favicon_mime_type" varchar(30)`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bo"."companies" DROP COLUMN IF EXISTS "favicon_mime_type"`)
    await queryRunner.query(`ALTER TABLE "bo"."companies" DROP COLUMN IF EXISTS "favicon"`)
  }
}
