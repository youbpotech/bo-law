import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddClientPortugueseIdentifiers1785196800000 implements MigrationInterface {
  name = 'AddClientPortugueseIdentifiers1785196800000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bo.clients
        ADD COLUMN niss varchar(11),
        ADD COLUMN numero_utente_sns varchar(9),
        ADD COLUMN numero_ar varchar(9),
        ADD COLUMN numero_cartao_cidadao varchar(12),
        ADD CONSTRAINT clients_niss_format_check
          CHECK (niss IS NULL OR niss ~ '^[0-9]{11}$'),
        ADD CONSTRAINT clients_numero_utente_sns_format_check
          CHECK (numero_utente_sns IS NULL OR numero_utente_sns ~ '^[0-9]{9}$'),
        ADD CONSTRAINT clients_numero_ar_format_check
          CHECK (numero_ar IS NULL OR numero_ar ~ '^[A-Z0-9]{9}$'),
        ADD CONSTRAINT clients_numero_cartao_cidadao_format_check
          CHECK (
            numero_cartao_cidadao IS NULL
            OR numero_cartao_cidadao ~ '^[0-9]{9}[A-Z]{2}[0-9]$'
          );
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bo.clients
        DROP CONSTRAINT IF EXISTS clients_numero_cartao_cidadao_format_check,
        DROP CONSTRAINT IF EXISTS clients_numero_ar_format_check,
        DROP CONSTRAINT IF EXISTS clients_numero_utente_sns_format_check,
        DROP CONSTRAINT IF EXISTS clients_niss_format_check,
        DROP COLUMN IF EXISTS numero_cartao_cidadao,
        DROP COLUMN IF EXISTS numero_ar,
        DROP COLUMN IF EXISTS numero_utente_sns,
        DROP COLUMN IF EXISTS niss;
    `)
  }
}
