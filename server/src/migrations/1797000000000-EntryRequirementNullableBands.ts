import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `course.entry.min_gpa` / `min_english_band` become nullable, where null means
 * "never sourced from the institution" rather than "no requirement".
 *
 * The old `0` sentinel was actively misleading: the matching engine's gates are
 * `gpa + 3 < min_gpa` and `band + 0.5 < min_english_band`, so a 0 *passed*
 * every applicant and an unsourced course looked like it had no entry bar at
 * all. Backfills existing 0s to null so those rows now report "unknown" and
 * land as conditionally_eligible. Hand-written per this repo's migration
 * pattern; `jsonb_typeof` guards keep it re-runnable.
 */
export class EntryRequirementNullableBands1797000000000 implements MigrationInterface {
  name = 'EntryRequirementNullableBands1797000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "course" SET "entry" = "entry" || jsonb_build_object(
        'min_gpa',
          CASE WHEN jsonb_typeof("entry" -> 'min_gpa') = 'number'
                AND ("entry" ->> 'min_gpa')::numeric > 0
               THEN "entry" -> 'min_gpa' ELSE 'null'::jsonb END,
        'min_english_band',
          CASE WHEN jsonb_typeof("entry" -> 'min_english_band') = 'number'
                AND ("entry" ->> 'min_english_band')::numeric > 0
               THEN "entry" -> 'min_english_band' ELSE 'null'::jsonb END,
        'requirement_source',
          CASE WHEN "entry" ? 'requirement_source'
               THEN "entry" -> 'requirement_source'
               WHEN "data_confidence" = 'unverified_aggregator'
                AND jsonb_typeof("entry" -> 'min_english_band') = 'number'
                AND ("entry" ->> 'min_english_band')::numeric > 0
               THEN '"unverified_aggregator"'::jsonb
               ELSE 'null'::jsonb END
      )
      WHERE "entry" IS NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "course" ALTER COLUMN "entry" SET DEFAULT
        '{"min_gpa":null,"min_english_band":null,"accepted_tests":["IELTS","PTE","TOEFL"],"prerequisites":[],"work_experience_months":0,"requirement_source":null}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "course" ALTER COLUMN "entry" SET DEFAULT
        '{"min_gpa":0,"min_english_band":0,"accepted_tests":["IELTS","PTE","TOEFL"],"prerequisites":[],"work_experience_months":0}'
    `);
    await queryRunner.query(`
      UPDATE "course" SET "entry" = ("entry" - 'requirement_source') || jsonb_build_object(
        'min_gpa',
          CASE WHEN jsonb_typeof("entry" -> 'min_gpa') = 'number'
               THEN "entry" -> 'min_gpa' ELSE '0'::jsonb END,
        'min_english_band',
          CASE WHEN jsonb_typeof("entry" -> 'min_english_band') = 'number'
               THEN "entry" -> 'min_english_band' ELSE '0'::jsonb END
      )
      WHERE "entry" IS NOT NULL
    `);
  }
}
