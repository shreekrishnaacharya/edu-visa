// ---------------------------------------------------------------------------
// Seeds the AU catalogue from the committed CRICOS register fixture in
// server/data/cricos/ — see that directory's README.md for provenance. Real
// institutions, real campus cities, real course titles, real fees.
//
// This is the OFFLINE path, for a fresh dev database and for tests. The live
// path is the data-sync module (`POST /data-sync/runs/cricos`), which pulls the
// current register from data.gov.au, diffs it, and applies what a human accepts.
// Both share `modules/data-sync/cricos-mapper.ts`, so seeding and syncing can
// never produce different rows from the same source file.
//
// Entry requirements are NOT in CRICOS data and are NOT guessed here: every
// course seeds with `min_gpa`/`min_english_band` null, and the matching engine
// reports those gates as "unknown" rather than inventing a bar. Real bands are
// layered on per institution from each provider's own admissions page.
//
// Run with: npx ts-node -r tsconfig-paths/register src/seed/cricos-import.ts
// ---------------------------------------------------------------------------

import 'reflect-metadata';
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';
import { DataSource, In, Not } from 'typeorm';
import { dataSourceOptions } from '../config/data-source';
import { University } from '../modules/university/university.entity';
import { Course } from '../modules/course/course.entity';
import { EMPTY_ENTRY_REQUIREMENT } from '../modules/course/entry-requirement';
import {
  locationsByCode,
  mapCampuses,
  mapCourse,
  mapUniversity,
  QS_RANK,
} from '../modules/data-sync/cricos-mapper';
import { UniversityCampus } from '../modules/university/university-campus.entity';
import { CourseCampus } from '../modules/course/course-campus.entity';

const DATA_DIR = join(__dirname, '..', '..', 'data', 'cricos');

function readCsv(file: string): Record<string, string>[] {
  return parse(readFileSync(join(DATA_DIR, file)), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });
}

/** CRICOS carries no live intake dates — forward-looking placeholders, flagged as such. */
function isoInMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const ds = new DataSource(dataSourceOptions);
  await ds.initialize();
  console.log('Connected. Seeding the AU catalogue from the CRICOS register fixture...');

  const uniRepo = ds.getRepository(University);
  const courseRepo = ds.getRepository(Course);
  const campusRepo = ds.getRepository(UniversityCampus);
  const courseCampusRepo = ds.getRepository(CourseCampus);

  const institutions = readCsv('institutions.csv');
  const courses = readCsv('courses.csv');
  const locationsFor = locationsByCode(readCsv('locations.csv'));
  const courseLocations = readCsv('course-locations.csv');

  // Universities are UPSERTED by CRICOS provider code, not wiped and recreated.
  //
  // The previous delete-all-then-insert had a rule to preserve any university
  // holding an `unverified_aggregator` course, so the aggregator import's rows
  // survived. Once those aggregator courses were merged onto the real register
  // rows, that rule started protecting *register* rows — which were then
  // re-inserted, producing two rows per provider for all 8 merged institutions.
  // Upserting on the provider code removes that whole class of bug and makes
  // re-running this seed idempotent.
  //
  // Courses are still replaced wholesale, except aggregator-sourced ones, which
  // this import does not own.
  const aggregatorUniIds = (
    await courseRepo
      .createQueryBuilder('c')
      .select('DISTINCT c.university_id', 'university_id')
      .where('c.country = :country', { country: 'AU' })
      .andWhere("c.data_confidence = 'unverified_aggregator'")
      .getRawMany()
  ).map((r: { university_id: string }) => r.university_id);

  const oldCourses = await courseRepo.count({
    where: { country: 'AU', data_confidence: 'verified' },
  });
  await courseRepo.delete({ country: 'AU', data_confidence: 'verified' });
  console.log(
    `  removed ${oldCourses} register-sourced courses` +
      (aggregatorUniIds.length
        ? `; kept aggregator-sourced courses at ${aggregatorUniIds.length} institution(s)`
        : ''),
  );

  const now = new Date();
  const uniIdByCode = new Map<string, string>();
  const uniByCode = new Map<string, ReturnType<typeof mapUniversity>>();
  const uniBatch: Partial<University>[] = [];
  const codes: string[] = [];

  const campusesByCode = new Map<string, ReturnType<typeof mapCampuses>>();
  for (const inst of institutions) {
    const code0 = inst['CRICOS Provider Code'];
    const campusRows = mapCampuses(inst, locationsFor.get(code0) ?? []);
    campusesByCode.set(code0, campusRows);
    const mapped = mapUniversity(inst, campusRows);
    uniByCode.set(mapped.cricos_provider_code, mapped);
    codes.push(mapped.cricos_provider_code);
    uniBatch.push({
      name: mapped.name,
      country: 'AU',
      city: mapped.city,
      world_rank: mapped.world_rank,
      logo_hue: mapped.logo_hue,
      // Links this real CRICOS row to its already-reviewed admission_policy
      // briefing where one exists, so the real courses and the real policy for
      // an institution can find each other.
      policy_key: mapped.policy_key,
      cricos_provider_code: mapped.cricos_provider_code,
      institution_type: mapped.institution_type,
      student_capacity: mapped.student_capacity,
      website: mapped.website,
      address: mapped.address,
      content_hash: mapped.content_hash,
      last_fetched_at: now,
      verified_at: now,
    });
  }

  const existingByCode = new Map(
    (await uniRepo.find({ where: { country: 'AU' } }))
      .filter((u) => u.cricos_provider_code)
      .map((u) => [u.cricos_provider_code!, u]),
  );
  for (let i = 0; i < uniBatch.length; i++) {
    const row = uniBatch[i];
    const existing = existingByCode.get(codes[i]);
    if (existing) {
      await uniRepo.update(existing.id, row);
      uniIdByCode.set(codes[i], existing.id);
    } else {
      const saved = await uniRepo.save(uniRepo.create(row));
      uniIdByCode.set(codes[i], saved.id);
    }
  }

  // Register rows for providers no longer in the file. Never touched if they
  // hold aggregator courses this import doesn't own.
  const goneFromRegister = [...existingByCode.entries()]
    .filter(([code, u]) => !uniIdByCode.has(code) && !aggregatorUniIds.includes(u.id))
    .map(([, u]) => u.id);
  if (goneFromRegister.length) {
    await uniRepo.delete({ id: In(goneFromRegister) });
    console.log(`  removed ${goneFromRegister.length} provider(s) no longer in the register`);
  }
  // Campuses. Every registered location is kept, not just the primary one, so a
  // student who wants Melbourne can match CQU's Melbourne campus.
  const campusBatch: Partial<UniversityCampus>[] = [];
  const refreshedUniIds: string[] = [];
  for (const [code, rows] of campusesByCode) {
    const universityId = uniIdByCode.get(code);
    if (!universityId) continue;
    refreshedUniIds.push(universityId);
    for (const c of rows) campusBatch.push({ ...c, university_id: universityId });
  }
  // Replaced rather than appended: the table is unique on
  // (university_id, location_name, postcode), so a re-run would otherwise fail.
  for (let i = 0; i < refreshedUniIds.length; i += 500) {
    await campusRepo.delete({ university_id: In(refreshedUniIds.slice(i, i + 500)) });
  }
  for (let i = 0; i < campusBatch.length; i += 500) {
    await campusRepo.save(campusBatch.slice(i, i + 500));
  }
  const multi = [...campusesByCode.values()].filter((r) => r.length > 1).length;
  console.log(
    `  university_campus: ${campusBatch.length} rows (${multi} institutions teach at more than one location)`,
  );

  const ranked = Object.keys(QS_RANK).filter((c) => uniIdByCode.has(c)).length;
  const linked = uniBatch.filter((u) => u.policy_key).length;
  console.log(
    `  university: ${uniIdByCode.size} rows (${ranked} world-ranked, ${linked} linked to an admission policy)`,
  );

  let imported = 0;
  let skipped = 0;
  const batch: Partial<Course>[] = [];
  for (const row of courses) {
    const mapped = mapCourse(row);
    const universityId = mapped ? uniIdByCode.get(mapped.provider_code) : undefined;
    const uni = mapped ? uniByCode.get(mapped.provider_code) : undefined;
    if (!mapped || !universityId || !uni) {
      skipped++;
      continue;
    }
    batch.push({
      university_id: universityId,
      university_name: mapped.university_name,
      country: 'AU',
      city: uni.city,
      world_rank: uni.world_rank,
      title: mapped.title,
      degree_level: mapped.degree_level,
      field: mapped.field,
      duration_months: mapped.duration_months,
      tuition_fee: mapped.tuition_fee,
      currency: 'AUD',
      intakes: ['Feb', 'Jul'],
      next_intake_date: isoInMonths(mapped.degree_level === 'PhD' ? 6 : 3),
      application_deadline: isoInMonths(mapped.degree_level === 'PhD' ? 4 : 1),
      entry: { ...EMPTY_ENTRY_REQUIREMENT },
      career_outcomes: [],
      cricos: mapped.cricos,
      content_hash: mapped.content_hash,
      last_fetched_at: now,
      verified_at: now,
    });
    imported++;
  }

  for (let i = 0; i < batch.length; i += 200) {
    await courseRepo.save(batch.slice(i, i + 200));
  }

  // Link each course to the campuses that actually teach it. The provider-level
  // campus list says CQU operates in Melbourne; this says which of its courses
  // you can actually study there (47 of 79, not all of them).
  const campusIdByKey = new Map<string, string>();
  for (const c of await campusRepo.find()) {
    campusIdByKey.set(`${c.university_id}|${c.location_name}`, c.id);
  }
  const courseIdByCricos = new Map<string, string>();
  for (const c of await courseRepo.find({
    where: { country: 'AU', data_confidence: 'verified' },
    select: ['id', 'cricos'],
  })) {
    if (c.cricos) courseIdByCricos.set(c.cricos, c.id);
  }

  await courseCampusRepo.clear();
  const linkRows: Partial<CourseCampus>[] = [];
  const seenLink = new Set<string>();
  let unlinked = 0;
  for (const row of courseLocations) {
    const courseId = courseIdByCricos.get(row['CRICOS Course Code']);
    const universityId = uniIdByCode.get(row['CRICOS Provider Code']);
    if (!courseId || !universityId) {
      unlinked++;
      continue;
    }
    const campusId = campusIdByKey.get(`${universityId}|${row['Location Name']}`);
    if (!campusId) {
      unlinked++;
      continue;
    }
    const key = `${courseId}|${campusId}`;
    if (seenLink.has(key)) continue;
    seenLink.add(key);
    linkRows.push({ course_id: courseId, campus_id: campusId });
  }
  for (let i = 0; i < linkRows.length; i += 1000) {
    await courseCampusRepo.save(linkRows.slice(i, i + 1000));
  }
  // Keep the denormalised column in step with the links it is derived from.
  await courseRepo.query(`
    UPDATE "course" c SET "campus_cities" = coalesce(sub.cities, '{}')
    FROM (
      SELECT cc.course_id, array_agg(DISTINCT uc.city ORDER BY uc.city) AS cities
      FROM "course_campus" cc JOIN "university_campus" uc ON uc.id = cc.campus_id
      GROUP BY cc.course_id
    ) sub
    WHERE sub.course_id = c.id
  `);
  await courseRepo.query(`
    UPDATE "course" c SET "campus_cities" = '{}'
    WHERE array_length(c."campus_cities", 1) IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "course_campus" cc WHERE cc.course_id = c.id)
  `);

  const multiCampusCourses = new Set(
    linkRows.map((r) => r.course_id!),
  ).size;
  console.log(
    `  course_campus: ${linkRows.length} links across ${multiCampusCourses} course(s)` +
      (unlinked ? `; ${unlinked} register row(s) could not be linked` : ''),
  );

  console.log(
    `  course: ${imported} rows seeded, ${skipped} skipped (unmapped level, no fee/duration, or unknown provider)`,
  );
  console.log('  entry requirements left null — sourced per institution, never inferred here.');
  await ds.destroy();
  console.log('CRICOS seed complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
