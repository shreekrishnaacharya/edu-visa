import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Real official CRICOS registry profile fields on `university`
 * (PRODUCT_PLAN phase 9) — provider code, institution type, capacity,
 * website, address. Backfilled from the already-downloaded
 * data/cricos/institutions.csv via src/seed/cricos-institution-profile-backfill.ts,
 * not fabricated. Hand-written per this repo's established migration pattern.
 */
export class UniversityCricosProfile1796000000000 implements MigrationInterface {
  name = 'UniversityCricosProfile1796000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "university" ADD "cricos_provider_code" character varying`);
    await queryRunner.query(`ALTER TABLE "university" ADD "institution_type" character varying`);
    await queryRunner.query(`ALTER TABLE "university" ADD "student_capacity" integer`);
    await queryRunner.query(`ALTER TABLE "university" ADD "website" character varying`);
    await queryRunner.query(`ALTER TABLE "university" ADD "address" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "university" DROP COLUMN "address"`);
    await queryRunner.query(`ALTER TABLE "university" DROP COLUMN "website"`);
    await queryRunner.query(`ALTER TABLE "university" DROP COLUMN "student_capacity"`);
    await queryRunner.query(`ALTER TABLE "university" DROP COLUMN "institution_type"`);
    await queryRunner.query(`ALTER TABLE "university" DROP COLUMN "cricos_provider_code"`);
  }
}
