import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Records whether an institution's website can be read by the automated
 * requirement scraper at all.
 *
 * Roughly half the largest Australian universities cannot: Melbourne, Monash,
 * Sydney, Newcastle and Macquarie return HTTP 403 from anti-bot protection or
 * render their navigation client-side, and that is a standing property of the
 * site, not a transient error. Without recording it, every future run re-attempts
 * them, wastes the request budget, and reports the same failures as if they were
 * news. Flagged here so runs skip them by default and the UI can list them as
 * needing manual entry or a document upload instead.
 *
 * Hand-written per this repo's established migration pattern.
 */
export class UniversityAutoSourceStatus1799000000000 implements MigrationInterface {
  name = 'UniversityAutoSourceStatus1799000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "university" ADD "auto_source_status" character varying NOT NULL DEFAULT 'unknown'`,
    );
    await queryRunner.query(`ALTER TABLE "university" ADD "auto_source_reason" character varying`);
    await queryRunner.query(`ALTER TABLE "university" ADD "auto_source_note" text NOT NULL DEFAULT ''`);
    await queryRunner.query(
      `ALTER TABLE "university" ADD "auto_source_checked_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "university" ADD "auto_source_failures" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_university_auto_source_status" ON "university" ("auto_source_status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_university_auto_source_status"`);
    for (const col of [
      'auto_source_failures',
      'auto_source_checked_at',
      'auto_source_note',
      'auto_source_reason',
      'auto_source_status',
    ]) {
      await queryRunner.query(`ALTER TABLE "university" DROP COLUMN "${col}"`);
    }
  }
}
