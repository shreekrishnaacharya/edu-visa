import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Denormalises each course's teaching cities onto the course row.
 *
 * `course_campus` remains the detailed link (campus names, states) but reading it
 * for every match run cost ~55% more latency (0.83s -> 1.30s at 12,749 courses,
 * 19,471 join rows), and filtering the catalogue by city through it would need a
 * 3,393-element `id IN (...)` clause for Melbourne alone. The same
 * denormalisation already exists on this table for `university_name`, `city` and
 * `world_rank`, and `intakes` is already a text[].
 *
 * Hand-written per this repo's established migration pattern.
 */
export class CourseCampusCities1803000000000 implements MigrationInterface {
  name = 'CourseCampusCities1803000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course" ADD "campus_cities" text array NOT NULL DEFAULT '{}'`,
    );
    // Backfill from the links that already exist, so this does not depend on a reseed.
    await queryRunner.query(`
      UPDATE "course" c SET "campus_cities" = sub.cities
      FROM (
        SELECT cc.course_id, array_agg(DISTINCT uc.city ORDER BY uc.city) AS cities
        FROM "course_campus" cc
        JOIN "university_campus" uc ON uc.id = cc.campus_id
        GROUP BY cc.course_id
      ) sub
      WHERE sub.course_id = c.id
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_course_campus_cities" ON "course" USING GIN ("campus_cities")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_course_campus_cities"`);
    await queryRunner.query(`ALTER TABLE "course" DROP COLUMN "campus_cities"`);
  }
}
