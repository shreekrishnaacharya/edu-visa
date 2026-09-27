import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enforces one row per CRICOS provider.
 *
 * Uniqueness was previously only a convention in the import logic, and it broke
 * twice: once when the seed's "preserve rows holding aggregator courses" rule
 * started protecting register rows and re-inserted them, and once when the sync's
 * diff excluded those same universities and staged them as `create`. Both
 * produced two rows for CQU, UTAS, Newcastle and five others. The schema should
 * make that impossible rather than relying on every writer getting it right.
 *
 * `cricos_provider_code` is nullable and Postgres permits many NULLs in a unique
 * index, so records that legitimately are not in the register (Curtin College, a
 * Navitas pathway college) are unaffected.
 *
 * Hand-written per this repo's established migration pattern.
 */
export class UniqueProviderCode1804000000000 implements MigrationInterface {
  name = 'UniqueProviderCode1804000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dupes: { cricos_provider_code: string; n: string }[] = await queryRunner.query(`
      SELECT cricos_provider_code, count(*)::text AS n
        FROM university
       WHERE cricos_provider_code IS NOT NULL
       GROUP BY cricos_provider_code HAVING count(*) > 1
    `);
    if (dupes.length) {
      throw new Error(
        `Cannot add the unique index: ${dupes.length} provider code(s) still have duplicate rows ` +
          `(${dupes.map((d) => `${d.cricos_provider_code} x${d.n}`).join(', ')}). ` +
          `Run src/seed/merge-aggregator-duplicates.ts first.`,
      );
    }
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_university_cricos_provider_code" ON "university" ("cricos_provider_code")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_university_cricos_provider_code"`);
  }
}
