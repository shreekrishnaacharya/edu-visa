import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hand-written (not `migration:generate` — that command fails on this DB
 * with "relation typeorm_metadata does not exist", a pre-existing quirk from
 * `doc_chunk.tsv` being a raw-SQL generated column TypeORM doesn't track;
 * same reason the Knowledge migration was hand-written).
 *
 * Adds the fields the real per-institution admission-eligibility checks
 * (`src/modules/admission/`) needed but the domain model didn't have yet:
 * marriage duration + spouse qualification (`dependant`), sponsor bank name
 * (`sponsor`), backlog count (`academic_record`). See
 * `admission-eligibility.service.ts` for how each is used.
 */
export class AdmissionFields1789000000000 implements MigrationInterface {
  name = 'AdmissionFields1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "dependant" ADD "marriage_date" date`);
    await queryRunner.query(`ALTER TABLE "dependant" ADD "qualification_level" character varying`);
    await queryRunner.query(`ALTER TABLE "sponsor" ADD "bank_name" character varying NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "academic_record" ADD "backlogs" integer NOT NULL DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "academic_record" DROP COLUMN "backlogs"`);
    await queryRunner.query(`ALTER TABLE "sponsor" DROP COLUMN "bank_name"`);
    await queryRunner.query(`ALTER TABLE "dependant" DROP COLUMN "qualification_level"`);
    await queryRunner.query(`ALTER TABLE "dependant" DROP COLUMN "marriage_date"`);
  }
}
