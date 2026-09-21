import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Wires real admission-eligibility into the deterministic match engine
 * (PRODUCT_PLAN phase 4): `university.policy_key` links a catalogue row to
 * its real admission-policy.data.ts entry; `match_run.enforce_admission_eligibility`
 * persists whether a saved run treated a not_eligible verdict as a hard
 * knockout (the report's live toggle) or as informational-only. Hand-written
 * per this repo's established migration pattern.
 */
export class AdmissionEligibilityGate1793000000000 implements MigrationInterface {
  name = 'AdmissionEligibilityGate1793000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "university" ADD "policy_key" character varying`);
    await queryRunner.query(`ALTER TABLE "match_run" ADD "enforce_admission_eligibility" boolean NOT NULL DEFAULT true`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "match_run" DROP COLUMN "enforce_admission_eligibility"`);
    await queryRunner.query(`ALTER TABLE "university" DROP COLUMN "policy_key"`);
  }
}
