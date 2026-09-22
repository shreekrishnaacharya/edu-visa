import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Moves `AdmissionPolicy` from a static TS file to a real, writable table
 * (PRODUCT_PLAN phase 7) — so the university-document upload pipeline can
 * draft/update a real institution's eligibility rules, not just the 9
 * originally hand-typed ones. See server/scripts/seed-admission-policies.mjs
 * for the one-time seed of those 9. Hand-written per this repo's established
 * migration pattern.
 */
export class AdmissionPolicyTable1795000000000 implements MigrationInterface {
  name = 'AdmissionPolicyTable1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "admission_policy" (
        "key" character varying NOT NULL,
        "institution" character varying NOT NULL,
        "data" jsonb NOT NULL,
        "source_document_id" uuid,
        "review_status" character varying NOT NULL DEFAULT 'ai_drafted',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admission_policy" PRIMARY KEY ("key")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_admission_policy_institution" ON "admission_policy" ("institution")`);

    await queryRunner.query(`ALTER TABLE "university_document" ADD "policy_draft_status" character varying NOT NULL DEFAULT 'pending'`);
    await queryRunner.query(`ALTER TABLE "university_document" ADD "drafted_policy_key" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "university_document" DROP COLUMN "drafted_policy_key"`);
    await queryRunner.query(`ALTER TABLE "university_document" DROP COLUMN "policy_draft_status"`);
    await queryRunner.query(`DROP TABLE "admission_policy"`);
  }
}
