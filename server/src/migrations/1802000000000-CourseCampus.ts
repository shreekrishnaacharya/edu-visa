import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Which campuses actually teach a given course.
 *
 * `university_campus` established that a provider teaches in several cities, but
 * not that a *particular course* is available in any specific one. CQU teaches
 * in 11 cities, yet only 47 of its 79 in-scope courses run in Melbourne — so
 * scoring every CQU course as a Melbourne match overstates availability just as
 * badly as the old single-city model understated it.
 *
 * Fed from the register's own course-locations export, which joins to
 * `university_campus` on (provider code, location name) with a 100% hit rate
 * across all 19,508 in-scope rows.
 *
 * Hand-written per this repo's established migration pattern.
 */
export class CourseCampus1802000000000 implements MigrationInterface {
  name = 'CourseCampus1802000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "course_campus" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "course_id" uuid NOT NULL,
        "campus_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_course_campus" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_course_campus" UNIQUE ("course_id", "campus_id"),
        CONSTRAINT "FK_course_campus_course" FOREIGN KEY ("course_id")
          REFERENCES "course"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_course_campus_campus" FOREIGN KEY ("campus_id")
          REFERENCES "university_campus"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_course_campus_course" ON "course_campus" ("course_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_course_campus_campus" ON "course_campus" ("campus_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "course_campus"`);
  }
}
