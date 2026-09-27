import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Registered teaching locations per institution.
 *
 * A CRICOS provider is commonly one institution across many cities (CQU has 14
 * locations). The catalogue kept a single `university.city` taken from whichever
 * location came first in the register's file, discarding the rest — which made
 * the stored city arbitrary and made `locationScore` actively wrong, since it
 * compares that one city literally against a student's preferred cities.
 *
 * Hand-written per this repo's established migration pattern.
 */
export class UniversityCampuses1801000000000 implements MigrationInterface {
  name = 'UniversityCampuses1801000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "university_campus" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "university_id" uuid NOT NULL,
        "location_name" character varying NOT NULL,
        "city" character varying NOT NULL,
        "locality" character varying,
        "state" character varying(8),
        "postcode" character varying(12),
        "address" character varying,
        "is_primary" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_university_campus" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_university_campus_row" UNIQUE ("university_id", "location_name", "postcode"),
        CONSTRAINT "FK_university_campus_university" FOREIGN KEY ("university_id")
          REFERENCES "university"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_university_campus_university" ON "university_campus" ("university_id")`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_university_campus_city" ON "university_campus" ("city")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "university_campus"`);
  }
}
