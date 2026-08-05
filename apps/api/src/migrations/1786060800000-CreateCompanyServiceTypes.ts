import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateCompanyServiceTypes1786060800000 implements MigrationInterface {
  name = 'CreateCompanyServiceTypes1786060800000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "bo"."service_types" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" integer NOT NULL,
      "code" varchar(80) NOT NULL, "name" varchar(255) NOT NULL,
      "process_type" varchar(20) NOT NULL DEFAULT 'general', "description" text,
      "active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_bo_service_types" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_bo_service_types_company_code" UNIQUE ("company_id", "code"),
      CONSTRAINT "CHK_bo_service_types_process_type" CHECK ("process_type" IN ('general','niss','aima')),
      CONSTRAINT "FK_bo_service_types_company" FOREIGN KEY ("company_id") REFERENCES "bo"."companies"("id") ON DELETE RESTRICT
    )`)
    await queryRunner.query(`INSERT INTO "bo"."service_types" ("company_id", "code", "name", "process_type")
      SELECT c.id, seed.code, seed.name, seed.process_type FROM "bo"."companies" c CROSS JOIN (VALUES
        ('consultation','Consulta jurídica','general'), ('nationality','Nacionalidade portuguesa','general'),
        ('residence','Autorização de residência','general'), ('family-reunification','Reagrupamento familiar','general'),
        ('labour','Direito laboral','general'), ('litigation','Contencioso','general'),
        ('niss','Atribuição de NISS','niss'), ('aima','Acompanhamento de processo AIMA','aima')
      ) AS seed(code,name,process_type)`)
    await queryRunner.query(`ALTER TABLE "bo"."legal_cases" ADD COLUMN "service_id" uuid`)
    await queryRunner.query(`UPDATE "bo"."legal_cases" lc SET "service_id" = st.id FROM "bo"."service_types" st
      WHERE st.company_id = lc.company_id AND ((lc.case_type = 'niss' AND st.code = 'niss') OR (lc.case_type = 'aima' AND st.code = 'aima') OR lower(st.name) = lower(lc.service_type))`)
    await queryRunner.query(`INSERT INTO "bo"."service_types" ("company_id", "code", "name", "process_type")
      SELECT DISTINCT lc.company_id, 'legacy-' || substring(md5(lc.service_type) from 1 for 32), lc.service_type, 'general'
      FROM "bo"."legal_cases" lc WHERE lc.service_id IS NULL ON CONFLICT ("company_id", "code") DO NOTHING`)
    await queryRunner.query(`UPDATE "bo"."legal_cases" lc SET "service_id" = st.id FROM "bo"."service_types" st
      WHERE lc.service_id IS NULL AND st.company_id = lc.company_id AND st.code = 'legacy-' || substring(md5(lc.service_type) from 1 for 32)`)
    await queryRunner.query(`ALTER TABLE "bo"."legal_cases" ALTER COLUMN "service_id" SET NOT NULL`)
    await queryRunner.query(`ALTER TABLE "bo"."legal_cases" ADD CONSTRAINT "FK_bo_legal_cases_service" FOREIGN KEY ("service_id") REFERENCES "bo"."service_types"("id") ON DELETE RESTRICT`)
    await queryRunner.query(`CREATE INDEX "IDX_bo_legal_cases_service_id" ON "bo"."legal_cases" ("service_id")`)
    await queryRunner.query(`ALTER TABLE "bo"."legal_cases" DROP COLUMN "service_type"`)
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bo"."legal_cases" ADD COLUMN "service_type" text`)
    await queryRunner.query(`UPDATE "bo"."legal_cases" lc SET "service_type" = st.name FROM "bo"."service_types" st WHERE st.id = lc.service_id`)
    await queryRunner.query(`ALTER TABLE "bo"."legal_cases" ALTER COLUMN "service_type" SET NOT NULL`)
    await queryRunner.query(`ALTER TABLE "bo"."legal_cases" DROP CONSTRAINT "FK_bo_legal_cases_service"`)
    await queryRunner.query(`DROP INDEX "bo"."IDX_bo_legal_cases_service_id"`)
    await queryRunner.query(`ALTER TABLE "bo"."legal_cases" DROP COLUMN "service_id"`)
    await queryRunner.query(`DROP TABLE "bo"."service_types"`)
  }
}
