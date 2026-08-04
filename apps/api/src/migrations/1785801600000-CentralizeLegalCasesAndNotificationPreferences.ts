import { MigrationInterface, QueryRunner } from 'typeorm'

export class CentralizeLegalCasesAndNotificationPreferences1785801600000
  implements MigrationInterface
{
  name = 'CentralizeLegalCasesAndNotificationPreferences1785801600000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bo"."users" ADD COLUMN IF NOT EXISTS "phone" varchar(40)`,
    )

    await queryRunner.query(
      `ALTER TABLE "bo"."legal_cases" ADD COLUMN IF NOT EXISTS "created_by_user_id" uuid`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."legal_cases" ADD COLUMN IF NOT EXISTS "case_type" varchar(50) NOT NULL DEFAULT 'general'`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."legal_cases" ADD COLUMN IF NOT EXISTS "integration_status" varchar(30) NOT NULL DEFAULT 'not_applicable'`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."legal_cases" ALTER COLUMN "contracted_fee" DROP NOT NULL`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."legal_cases" ALTER COLUMN "contract_signed_at" DROP NOT NULL`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."legal_cases" DROP CONSTRAINT IF EXISTS "CK_bo_legal_cases_fee"`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."legal_cases" ADD CONSTRAINT "CK_bo_legal_cases_fee" CHECK ("contracted_fee" IS NULL OR "contracted_fee" > 0)`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."legal_cases" DROP CONSTRAINT IF EXISTS "CK_bo_legal_cases_integration_status"`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."legal_cases" ADD CONSTRAINT "CK_bo_legal_cases_integration_status" CHECK ("integration_status" IN ('not_applicable', 'pending', 'active', 'failed', 'completed'))`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."legal_cases" DROP CONSTRAINT IF EXISTS "FK_bo_legal_cases_created_by"`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."legal_cases" ADD CONSTRAINT "FK_bo_legal_cases_created_by" FOREIGN KEY ("created_by_user_id") REFERENCES "bo"."users"("id") ON DELETE SET NULL`,
    )
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_bo_legal_cases_type" ON "bo"."legal_cases" ("company_id", "case_type", "updated_at" DESC)`,
    )

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bo"."legal_case_stakeholders" (
        "legal_case_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" varchar(20) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bo_legal_case_stakeholders" PRIMARY KEY ("legal_case_id", "user_id"),
        CONSTRAINT "CK_bo_legal_case_stakeholders_role" CHECK ("role" IN ('creator', 'stakeholder')),
        CONSTRAINT "FK_bo_legal_case_stakeholders_case" FOREIGN KEY ("legal_case_id")
          REFERENCES "bo"."legal_cases"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_bo_legal_case_stakeholders_user" FOREIGN KEY ("user_id")
          REFERENCES "bo"."users"("id") ON DELETE RESTRICT
      )
    `)
    await queryRunner.query(`
      INSERT INTO "bo"."legal_case_stakeholders" ("legal_case_id", "user_id", "role")
      SELECT "id", "created_by_user_id", 'creator'
        FROM "bo"."legal_cases"
       WHERE "created_by_user_id" IS NOT NULL
      ON CONFLICT ("legal_case_id", "user_id") DO UPDATE SET "role" = 'creator'
    `)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_bo_legal_case_stakeholders_user" ON "bo"."legal_case_stakeholders" ("user_id", "created_at" DESC)`,
    )

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bo"."legal_case_integrations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "legal_case_id" uuid NOT NULL,
        "provider" varchar(50) NOT NULL,
        "external_process_id" varchar(255),
        "external_reference" varchar(500) NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'pending',
        "last_error" text,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bo_legal_case_integrations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_bo_legal_case_integrations_case_provider" UNIQUE ("legal_case_id", "provider"),
        CONSTRAINT "UQ_bo_legal_case_integrations_reference" UNIQUE ("provider", "external_reference"),
        CONSTRAINT "CK_bo_legal_case_integrations_status" CHECK ("status" IN ('pending', 'active', 'failed', 'completed')),
        CONSTRAINT "FK_bo_legal_case_integrations_case" FOREIGN KEY ("legal_case_id")
          REFERENCES "bo"."legal_cases"("id") ON DELETE CASCADE
      )
    `)
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_bo_legal_case_integrations_external_id" ON "bo"."legal_case_integrations" ("provider", "external_process_id") WHERE "external_process_id" IS NOT NULL`,
    )

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bo"."user_notification_channels" (
        "user_id" uuid NOT NULL,
        "channel" varchar(20) NOT NULL,
        "enabled" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bo_user_notification_channels" PRIMARY KEY ("user_id", "channel"),
        CONSTRAINT "CK_bo_user_notification_channels_channel" CHECK ("channel" IN ('internal', 'email', 'whatsapp', 'sms')),
        CONSTRAINT "FK_bo_user_notification_channels_user" FOREIGN KEY ("user_id")
          REFERENCES "bo"."users"("id") ON DELETE CASCADE
      )
    `)
    await queryRunner.query(`
      INSERT INTO "bo"."user_notification_channels" ("user_id", "channel", "enabled")
      SELECT "id", channel."name", channel."name" = 'internal'
        FROM "bo"."users"
       CROSS JOIN (VALUES ('internal'), ('email'), ('whatsapp'), ('sms')) AS channel("name")
      ON CONFLICT ("user_id", "channel") DO NOTHING
    `)

    await queryRunner.query(
      `ALTER TABLE "bo"."notifications" ADD COLUMN IF NOT EXISTS "legal_case_id" uuid`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."notifications" ADD COLUMN IF NOT EXISTS "event_type" varchar(100)`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."notifications" ADD COLUMN IF NOT EXISTS "idempotency_key" varchar(255)`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."notifications" DROP CONSTRAINT IF EXISTS "FK_bo_notifications_legal_case_id"`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."notifications" ADD CONSTRAINT "FK_bo_notifications_legal_case_id" FOREIGN KEY ("legal_case_id") REFERENCES "bo"."legal_cases"("id") ON DELETE SET NULL`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."notifications" DROP CONSTRAINT IF EXISTS "CK_bo_notifications_channels_valid"`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."notifications" ADD CONSTRAINT "CK_bo_notifications_channels_valid" CHECK ("channels" <@ ARRAY['internal', 'email', 'whatsapp', 'sms']::text[])`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."notification_deliveries" DROP CONSTRAINT IF EXISTS "CK_bo_notification_delivery_channel"`,
    )
    await queryRunner.query(
      `ALTER TABLE "bo"."notification_deliveries" ADD CONSTRAINT "CK_bo_notification_delivery_channel" CHECK ("channel" IN ('internal', 'email', 'whatsapp', 'sms'))`,
    )
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_bo_notifications_legal_case" ON "bo"."notifications" ("legal_case_id", "created_at" DESC)`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_bo_notifications_event_recipient" ON "bo"."notifications" ("company_id", "idempotency_key", "recipient_user_id") WHERE "idempotency_key" IS NOT NULL AND "recipient_user_id" IS NOT NULL`,
    )
  }

  public async down(): Promise<void> {
    throw new Error(
      'A centralização de processos e preferências é irreversível; restaure um backup para voltar ao modelo anterior.',
    )
  }
}
