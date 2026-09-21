import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets a `course` row be tagged as sourced from an unverified third-party
 * aggregator rather than the CRICOS-import / human-verified Tier-1 catalogue
 * — added when researching real course data for the 9 admission-policy
 * institutions hit official-site 403s across the board, leaving aggregator
 * data (which conflicted by up to 18% between sources) as the only fetchable
 * option. `data_confidence` lets the AI orchestrator cite these honestly
 * instead of with the same "authoritative" confidence as real CRICOS rows.
 */
export class CourseDataConfidence1792000000000 implements MigrationInterface {
  name = 'CourseDataConfidence1792000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "course" ADD "data_confidence" character varying NOT NULL DEFAULT 'verified'`);
    await queryRunner.query(`ALTER TABLE "course" ADD "source_note" text NOT NULL DEFAULT ''`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "course" DROP COLUMN "source_note"`);
    await queryRunner.query(`ALTER TABLE "course" DROP COLUMN "data_confidence"`);
  }
}
