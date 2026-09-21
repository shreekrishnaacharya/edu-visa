import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "What-if" profile overrides on the match report (PRODUCT_PLAN phase 5) —
 * lets a counsellor explore a hypothetical (higher English score, different
 * preferred country, ...) without editing the student's real stored profile.
 * Hand-written per this repo's established migration pattern.
 */
export class MatchRunProfileOverride1794000000000 implements MigrationInterface {
  name = 'MatchRunProfileOverride1794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "match_run" ADD "profile_override" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "match_run" DROP COLUMN "profile_override"`);
  }
}
