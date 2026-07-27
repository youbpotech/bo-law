import { gunzipSync } from 'node:zlib'
import { MigrationInterface, QueryRunner } from 'typeorm'
import { COUNTRIES_SQL_GZIP_BASE64, STATES_SQL_GZIP_BASE64 } from './geography-seed'

function sqlFromBase64(value: string): string {
  return gunzipSync(Buffer.from(value, 'base64')).toString('utf8')
}

export class AddGeographyReferences1785110400000 implements MigrationInterface {
  name = 'AddGeographyReferences1785110400000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(sqlFromBase64(COUNTRIES_SQL_GZIP_BASE64))
    await queryRunner.query(sqlFromBase64(STATES_SQL_GZIP_BASE64))
    await queryRunner.query(`
      CREATE INDEX countries_name_search_idx ON public.countries (lower(name));
      CREATE UNIQUE INDEX countries_iso2_unique_idx ON public.countries (iso2);
      CREATE INDEX states_name_search_idx ON public.states (country_id, lower(name));

      CREATE TABLE bo.custom_countries (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        company_id integer NOT NULL REFERENCES bo.companies(id) ON DELETE CASCADE,
        name varchar(100) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX custom_countries_company_name_unique_idx
        ON bo.custom_countries (company_id, lower(name));

      CREATE TABLE bo.custom_states (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        company_id integer NOT NULL REFERENCES bo.companies(id) ON DELETE CASCADE,
        country_id bigint REFERENCES public.countries(id) ON DELETE CASCADE,
        custom_country_id bigint REFERENCES bo.custom_countries(id) ON DELETE CASCADE,
        name varchar(255) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT custom_states_single_country CHECK (
          (country_id IS NOT NULL AND custom_country_id IS NULL)
          OR (country_id IS NULL AND custom_country_id IS NOT NULL)
        )
      );
      CREATE UNIQUE INDEX custom_states_official_country_name_unique_idx
        ON bo.custom_states (company_id, country_id, lower(name))
        WHERE country_id IS NOT NULL;
      CREATE UNIQUE INDEX custom_states_custom_country_name_unique_idx
        ON bo.custom_states (company_id, custom_country_id, lower(name))
        WHERE custom_country_id IS NOT NULL;
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS bo.custom_states;
      DROP TABLE IF EXISTS bo.custom_countries;
      DROP TABLE IF EXISTS public.states;
      DROP TABLE IF EXISTS public.countries;
    `)
  }
}
