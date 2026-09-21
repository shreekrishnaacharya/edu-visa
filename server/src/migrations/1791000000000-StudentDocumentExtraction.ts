import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Vision-extraction fields on `student_document` (backlog item #1 —
 * see plan appendix "Phase 2"). Hand-written to match this repo's established
 * pattern (see AdmissionFields/Knowledge/UniversityDocument migrations).
 */
export class StudentDocumentExtraction1791000000000 implements MigrationInterface {
  name = 'StudentDocumentExtraction1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "student_document" ADD "extracted_data" jsonb`);
    await queryRunner.query(`ALTER TABLE "student_document" ADD "extraction_status" character varying NOT NULL DEFAULT 'pending'`);
    await queryRunner.query(`ALTER TABLE "student_document" ADD "extraction_error" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "student_document" DROP COLUMN "extraction_error"`);
    await queryRunner.query(`ALTER TABLE "student_document" DROP COLUMN "extraction_status"`);
    await queryRunner.query(`ALTER TABLE "student_document" DROP COLUMN "extracted_data"`);
  }
}
