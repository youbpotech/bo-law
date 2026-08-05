import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCompanyLoginBanner1785283200000 implements MigrationInterface {
  name = 'AddCompanyLoginBanner1785283200000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bo"."companies" ADD COLUMN IF NOT EXISTS "banner_login" bytea`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."companies" ADD COLUMN IF NOT EXISTS "banner_login_mime_type" varchar(30)`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bo"."companies" DROP COLUMN IF EXISTS "banner_login_mime_type"`,
    )
    await queryRunner.query(`ALTER TABLE "bo"."companies" DROP COLUMN IF EXISTS "banner_login"`)
  }
}
