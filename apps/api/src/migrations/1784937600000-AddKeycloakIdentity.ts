import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddKeycloakIdentity1784937600000 implements MigrationInterface {
  name = 'AddKeycloakIdentity1784937600000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bo"."users" ADD COLUMN IF NOT EXISTS "keycloak_id" uuid`)
    await queryRunner.query(`ALTER TABLE "bo"."users" ALTER COLUMN "password" DROP NOT NULL`)
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_bo_users_keycloak_id" ON "bo"."users" ("keycloak_id") WHERE "keycloak_id" IS NOT NULL`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "bo"."UQ_bo_users_keycloak_id"`)
    await queryRunner.query(`ALTER TABLE "bo"."users" DROP COLUMN IF EXISTS "keycloak_id"`)
  }
}
