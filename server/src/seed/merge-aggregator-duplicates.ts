// ---------------------------------------------------------------------------
// Merges the aggregator-created university rows into their real CRICOS register
// counterpart, so one institution is one row.
//
// WHY: `aggregator-research-import.ts` created 9 university rows back when the
// catalogue held only 8 institutions and those providers were missing. The
// register import now covers them, leaving two rows per institution — which
// splits an institution's courses, shows duplicates in every list and filter,
// and renders a detail page with no provider code, type, website or address.
//
// HOW THE TARGET IS CHOSEN: by CRICOS code, never by name similarity and never
// by shared `policy_key`. policy_key is unsafe here because one combined
// briefing (`curtin-griffith-eynesbury`) is shared by four rows, so matching on
// it would merge Curtin College's course into Griffith University.
//
// Curtin College is deliberately NOT merged: it is a distinct institution (a
// Navitas pathway college), not Curtin University, and it is legitimately absent
// from the register cut because its only course is a Diploma, below the
// higher-ed levels this catalogue imports.
//
// Aggregator courses keep `data_confidence: 'unverified_aggregator'` and their
// `source_note` — the point is to fix the duplication, not to launder
// third-party figures into verified data.
//
// Idempotent: re-running after a successful merge finds nothing to do.
//
// Run with: npx ts-node -r tsconfig-paths/register src/seed/merge-aggregator-duplicates.ts
//           (add --dry-run to report without writing)
// ---------------------------------------------------------------------------

import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../config/data-source';
import { University } from '../modules/university/university.entity';
import { Course } from '../modules/course/course.entity';

/**
 * Aggregator row name -> the CRICOS code that identifies its real counterpart.
 * Each was verified against data/cricos/: four are course codes that exist in
 * the register, four are the institution's own provider code (the aggregator
 * import recorded a provider code where it could not find a course-level one).
 */
const MERGE_BY_CRICOS: Record<string, string> = {
  'Excelsia College': '02664K',
  'Sydney Met (formerly MIT Sydney)': '03906M',
  'Torrens University': '03389E',
  'University of Tasmania (UTAS)': '00586B',
  'Central Queensland University (CQU)': '00219C',
  'Southern Cross University (SCU)': '01241G',
  'ACAP (Australian College of Applied Psychology) University College — Navitas': '01328A',
  'University of Newcastle (UON)': '00109J',
};

/** Left alone, with the reason, so a future run doesn't quietly "fix" it. */
const KEEP_SEPARATE: Record<string, string> = {
  'Curtin College':
    'a distinct Navitas pathway college, not Curtin University; absent from the register cut because its only course is a Diploma',
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const ds = new DataSource(dataSourceOptions);
  await ds.initialize();
  const uniRepo = ds.getRepository(University);
  const courseRepo = ds.getRepository(Course);

  console.log(`Merging aggregator duplicates${dryRun ? ' (dry run — no writes)' : ''}...`);

  const aggregatorUniIds = new Set(
    (
      await courseRepo
        .createQueryBuilder('c')
        .select('DISTINCT c.university_id', 'university_id')
        .where("c.data_confidence = 'unverified_aggregator'")
        .getRawMany()
    ).map((r: { university_id: string }) => r.university_id),
  );

  const duplicates = (await uniRepo.find()).filter(
    (u) => aggregatorUniIds.has(u.id) && !u.cricos_provider_code,
  );
  if (!duplicates.length) {
    console.log('  nothing to merge — no aggregator row without a provider code.');
    await ds.destroy();
    return;
  }

  let merged = 0;
  let movedCourses = 0;
  const skipped: string[] = [];

  for (const dup of duplicates) {
    const reason = KEEP_SEPARATE[dup.name];
    if (reason) {
      skipped.push(`${dup.name} — kept separate: ${reason}`);
      continue;
    }

    const code = MERGE_BY_CRICOS[dup.name];
    if (!code) {
      skipped.push(`${dup.name} — no verified CRICOS target; left untouched`);
      continue;
    }

    const target = await uniRepo.findOne({ where: { cricos_provider_code: code } });
    if (!target) {
      skipped.push(`${dup.name} — target provider ${code} is not in the catalogue; left untouched`);
      continue;
    }

    const courses = await courseRepo.find({ where: { university_id: dup.id } });
    console.log(
      `  ${dup.name}\n    -> ${target.name} (${code}) — moving ${courses.length} course(s)`,
    );
    if (dryRun) {
      merged++;
      movedCourses += courses.length;
      continue;
    }

    // Re-point the courses and refresh the columns denormalised off the
    // university, so a moved course doesn't keep the duplicate's city/rank.
    for (const c of courses) {
      await courseRepo.update(c.id, {
        university_id: target.id,
        university_name: target.name,
        city: target.city,
        world_rank: target.world_rank,
      });
    }
    movedCourses += courses.length;

    // Keep the policy link if the register row somehow lacks one.
    if (!target.policy_key && dup.policy_key) {
      await uniRepo.update(target.id, { policy_key: dup.policy_key });
    }

    // Safe to remove now: nothing references it. university_document,
    // source_page, sync_change and curation_session were all verified empty for
    // these rows, and `course` has just been re-pointed.
    const remaining = await courseRepo.count({ where: { university_id: dup.id } });
    if (remaining > 0) {
      skipped.push(`${dup.name} — ${remaining} course(s) still attached, not deleted`);
      continue;
    }
    await uniRepo.delete(dup.id);
    merged++;
  }

  console.log(
    `\n  merged ${merged} duplicate row(s), moved ${movedCourses} course(s)` +
      (dryRun ? ' (dry run)' : ''),
  );
  for (const s of skipped) console.log(`  kept: ${s}`);

  const totalUnis = await uniRepo.count({ where: { country: 'AU' } });
  const stillDup = (await uniRepo.find()).filter(
    (u) => aggregatorUniIds.has(u.id) && !u.cricos_provider_code,
  ).length;
  console.log(`  AU universities now: ${totalUnis}; aggregator rows remaining: ${stillDup}`);

  await ds.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
