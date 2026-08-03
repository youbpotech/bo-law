import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddOmnichannelNotifications1785369600000 implements MigrationInterface {
  name = 'AddOmnichannelNotifications1785369600000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bo"."notifications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" integer NOT NULL,
        "recipient_user_id" uuid,
        "created_by_user_id" uuid,
        "title" varchar(255) NOT NULL,
        "body" text NOT NULL,
        "channels" text[] NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "read_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bo_notifications_id" PRIMARY KEY ("id"),
        CONSTRAINT "CK_bo_notifications_channels_not_empty" CHECK (cardinality("channels") > 0),
        CONSTRAINT "CK_bo_notifications_channels_valid" CHECK (
          "channels" <@ ARRAY['email', 'whatsapp', 'internal']::text[]
        ),
        CONSTRAINT "CK_bo_notifications_status" CHECK (
          "status" IN ('pending', 'sent', 'partial', 'failed')
        ),
        CONSTRAINT "FK_bo_notifications_company_id" FOREIGN KEY ("company_id")
          REFERENCES "bo"."companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_bo_notifications_recipient_user_id" FOREIGN KEY ("recipient_user_id")
          REFERENCES "bo"."users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_bo_notifications_created_by_user_id" FOREIGN KEY ("created_by_user_id")
          REFERENCES "bo"."users"("id") ON DELETE SET NULL
      )
    `)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_bo_notifications_recipient" ON "bo"."notifications" ("company_id", "recipient_user_id", "created_at" DESC)`,
    )

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bo"."notification_deliveries" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "notification_id" uuid NOT NULL,
        "channel" varchar(20) NOT NULL,
        "recipient" varchar(320) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "attempts" integer NOT NULL DEFAULT 0,
        "provider_message_id" varchar(255),
        "last_error" text,
        "next_attempt_at" timestamptz NOT NULL DEFAULT now(),
        "sent_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bo_notification_deliveries_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_bo_notification_delivery_channel" UNIQUE ("notification_id", "channel"),
        CONSTRAINT "CK_bo_notification_delivery_channel" CHECK (
          "channel" IN ('email', 'whatsapp', 'internal')
        ),
        CONSTRAINT "CK_bo_notification_delivery_status" CHECK (
          "status" IN ('pending', 'processing', 'sent', 'failed')
        ),
        CONSTRAINT "FK_bo_notification_deliveries_notification_id" FOREIGN KEY ("notification_id")
          REFERENCES "bo"."notifications"("id") ON DELETE CASCADE
      )
    `)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_bo_notification_deliveries_pending" ON "bo"."notification_deliveries" ("next_attempt_at", "created_at") WHERE "status" = 'pending'`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "bo"."notification_deliveries"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "bo"."notifications"`)
  }
}
