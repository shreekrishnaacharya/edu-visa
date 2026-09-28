// ---------------------------------------------------------------------------
// HAPPY-PATH MATCH FIXTURE — reversible, clearly marked test data.
//
// WHY: the live catalogue cannot exercise the matcher's happy path. `min_gpa`
// exists on 9 of 12,758 courses, `min_english_band` on 450, and there are ZERO
// rows for prerequisites, work-experience requirements, career outcomes and
// scholarships. So five of the six scoring dimensions are near-constant and
// three knockout rules are unreachable — you cannot tell "the engine ranked
// this correctly" from "the engine had nothing to rank on".
//
// This fixture supplies ONE institution where every field the engine reads is
// populated, so the happy path can be asserted end to end: an expected course
// for an expected profile, a real `eligible` admission verdict rather than
// `insufficient_data`, and weight tuning that moves the ranking in a
// predictable direction.
//
// NOT REAL DATA. Every row is marked so it can be removed completely:
//   university.cricos_provider_code = 'ZZTEST01'
//   course.source_note              = HAPPY_PATH_MARK
//   course.data_confidence          = 'unverified_aggregator'  (never 'verified')
//   admission_policy.key            = 'zz-happy-path'
//   student.branch                  = HAPPY_PATH_MARK
// `down()` deletes exactly those and nothing else.
//
// The field label is deliberately one with NO substring overlap against any of
// the 311 real CRICOS field labels (verified by query). careerScore matches a
// student's goal against `course.field` by substring in both directions, so a
// colliding label would silently pull hundreds of real courses into the
// scenario and make every expectation meaningless.
//
// Run:  npx ts-node -r tsconfig-paths/register src/seed/happy-path-fixture.ts
//       npx ts-node -r tsconfig-paths/register src/seed/happy-path-fixture.ts --down
// ---------------------------------------------------------------------------

import { DataSource } from 'typeorm';
import AppDataSource from '../config/data-source';
import { AdmissionPolicy } from '../modules/admission/admission-policy.types';

export const HAPPY_PATH_MARK = 'HAPPY_PATH_FIXTURE';
export const FIXTURE_PROVIDER_CODE = 'ZZTEST01';
export const FIXTURE_POLICY_KEY = 'zz-happy-path';
export const FIXTURE_FIELD = 'Applied Data Engineering';
export const FIXTURE_CITY = 'Melbourne';

/** Far enough out that the 18-month planning-window knockout passes. */
function futureDate(monthsAhead: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsAhead);
  return d.toISOString().slice(0, 10);
}

export interface FixtureCourse {
  key: string;
  title: string;
  degree_level: 'Bachelor' | 'PG Diploma' | 'Master' | 'PhD';
  duration_months: number;
  tuition_fee: number;
  min_gpa: number;
  min_english_band: number;
  prerequisites: string[];
  work_experience_months: number;
  career_outcomes: string[];
  scholarships: { name: string; pct: number; min_gpa: number; criteria: string }[];
}

/**
 * Five courses that differ on ONE axis at a time, so a ranking change can be
 * attributed to a dimension rather than guessed at.
 *   flagship     — the reference course
 *   advanced     — same but dearer and academically harder
 *   accelerated  — same bars, cheapest and shortest (financial axis)
 *   diploma      — a level BELOW the target (level-penalty axis)
 *   research     — requires two years' relevant experience (experience axis)
 */
export const FIXTURE_COURSES: FixtureCourse[] = [
  {
    key: 'flagship',
    title: 'Master of Applied Data Engineering',
    degree_level: 'Master',
    duration_months: 24,
    tuition_fee: 32000,
    min_gpa: 70,
    min_english_band: 6.5,
    prerequisites: ['Undergraduate degree in computing, engineering or a quantitative discipline'],
    work_experience_months: 0,
    career_outcomes: ['Data Engineer', 'Analytics Engineer', 'Platform Engineer'],
    scholarships: [
      { name: 'Fixture Merit Award', pct: 25, min_gpa: 85, criteria: 'Canonical GPA 85+' },
    ],
  },
  {
    key: 'advanced',
    title: 'Master of Applied Data Engineering (Advanced)',
    degree_level: 'Master',
    duration_months: 24,
    tuition_fee: 46000,
    min_gpa: 78,
    min_english_band: 7.0,
    prerequisites: ['Undergraduate degree in computing, engineering or a quantitative discipline'],
    work_experience_months: 0,
    career_outcomes: ['Data Engineer', 'Machine Learning Engineer'],
    scholarships: [
      { name: 'Fixture Excellence Award', pct: 15, min_gpa: 92, criteria: 'Canonical GPA 92+' },
    ],
  },
  {
    key: 'accelerated',
    title: 'Master of Applied Data Engineering (Accelerated)',
    degree_level: 'Master',
    duration_months: 18,
    tuition_fee: 24000,
    min_gpa: 70,
    min_english_band: 6.5,
    prerequisites: ['Undergraduate degree in computing, engineering or a quantitative discipline'],
    work_experience_months: 0,
    career_outcomes: ['Data Engineer', 'Analytics Engineer'],
    scholarships: [],
  },
  {
    key: 'diploma',
    title: 'Graduate Diploma of Applied Data Engineering',
    degree_level: 'PG Diploma',
    duration_months: 12,
    tuition_fee: 21000,
    min_gpa: 62,
    min_english_band: 6.0,
    prerequisites: ['Undergraduate degree in any discipline'],
    work_experience_months: 0,
    career_outcomes: ['Data Technician', 'Junior Data Engineer'],
    scholarships: [],
  },
  {
    key: 'research',
    title: 'Master of Applied Data Engineering (Research)',
    degree_level: 'Master',
    duration_months: 24,
    tuition_fee: 30000,
    min_gpa: 80,
    min_english_band: 7.0,
    prerequisites: ['Undergraduate degree in computing, engineering or a quantitative discipline'],
    work_experience_months: 24,
    career_outcomes: ['Research Engineer', 'Data Engineer'],
    scholarships: [],
  },
];

/**
 * Minimal on purpose. `evaluate()` only raises checks for the sections a policy
 * actually carries, so a policy of academics alone yields a clean
 * academic + English verdict — which is what the happy path needs to assert
 * `eligible` instead of `insufficient_data`. Sponsor caps, income floors and
 * study-gap rules are separately tested elsewhere and would only add ways for
 * this scenario to fail for reasons unrelated to course matching.
 */
export const FIXTURE_POLICY: AdmissionPolicy = {
  key: FIXTURE_POLICY_KEY,
  institution: 'Fixture Institute of Technology (QA)',
  scope: 'Happy-path test fixture — not a real institution',
  source: 'happy-path-fixture.ts',
  academics: [
    {
      level: 'PG',
      label: 'Postgraduate (general)',
      min_canonical_score: 70,
      source_expression: '70% or CGPA 2.8/4.0',
      min_ielts_overall: 6.5,
      min_ielts_band: 6.0,
      min_pte_overall: 58,
      min_pte_band: 50,
    },
    {
      level: 'UG',
      label: 'Undergraduate (general)',
      min_canonical_score: 60,
      source_expression: '60%',
      min_ielts_overall: 6.0,
      min_ielts_band: 5.5,
      min_pte_overall: 50,
      min_pte_band: 42,
    },
  ],
  sponsors: [],
  income_thresholds: [],
  other_notes: [],
};

export async function up(ds: DataSource): Promise<{ university_id: string; course_ids: Record<string, string> }> {
  const name = 'Fixture Institute of Technology (QA)';
  // world_rank 45 so locationScore's `ranking_matters && world_rank <= 60`
  // bonus can actually fire — only 5 real universities are ranked at all, so
  // that branch is otherwise untestable against live data.
  const [uni] = await ds.query(
    `INSERT INTO "university"
       (name, country, city, world_rank, policy_key, cricos_provider_code, institution_type, website, address, auto_source_status)
     VALUES ($1,'AU',$2,45,$3,$4,'Private','https://example.invalid/fixture','Fixture campus, Melbourne VIC','unknown')
     ON CONFLICT (cricos_provider_code) DO UPDATE
       SET name = EXCLUDED.name, policy_key = EXCLUDED.policy_key, world_rank = EXCLUDED.world_rank
     RETURNING id`,
    [name, FIXTURE_CITY, FIXTURE_POLICY_KEY, FIXTURE_PROVIDER_CODE],
  );
  const universityId: string = uni.id;

  await ds.query(
    `INSERT INTO "admission_policy" (key, institution, data, review_status)
     VALUES ($1,$2,$3::jsonb,'reviewed')
     ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, review_status = 'reviewed'`,
    [FIXTURE_POLICY_KEY, FIXTURE_POLICY.institution, JSON.stringify(FIXTURE_POLICY)],
  );

  // Rebuild courses from scratch each run so an edited fixture cannot leave a
  // stale row behind that still competes in the ranking.
  await ds.query(`DELETE FROM "course" WHERE source_note = $1`, [HAPPY_PATH_MARK]);

  const courseIds: Record<string, string> = {};
  for (const c of FIXTURE_COURSES) {
    const entry = {
      min_gpa: c.min_gpa,
      min_english_band: c.min_english_band,
      accepted_tests: ['IELTS', 'PTE', 'TOEFL'],
      prerequisites: c.prerequisites,
      work_experience_months: c.work_experience_months,
      requirement_source: `${HAPPY_PATH_MARK}: synthetic complete-data fixture`,
    };
    const [row] = await ds.query(
      `INSERT INTO "course"
         (university_id, university_name, country, city, world_rank, title, degree_level, field,
          duration_months, tuition_fee, currency, intakes, next_intake_date, application_deadline,
          entry, campus_cities, career_outcomes, cricos, data_confidence, source_note)
       VALUES ($1,$2,'AU',$3,45,$4,$5,$6,$7,$8,'AUD',$9,$10,$11,$12::jsonb,$13,$14,$15,'unverified_aggregator',$16)
       RETURNING id`,
      [
        universityId, FIXTURE_POLICY.institution, FIXTURE_CITY,
        c.title, c.degree_level, FIXTURE_FIELD,
        c.duration_months, c.tuition_fee,
        ['February', 'July'], futureDate(5), futureDate(3),
        JSON.stringify(entry), [FIXTURE_CITY], c.career_outcomes,
        `ZZ${c.key.toUpperCase().slice(0, 6)}`, HAPPY_PATH_MARK,
      ],
    );
    courseIds[c.key] = row.id;
    for (const s of c.scholarships) {
      await ds.query(
        `INSERT INTO "scholarship" (course_id, name, pct, criteria, min_gpa) VALUES ($1,$2,$3,$4,$5)`,
        [row.id, s.name, s.pct, s.criteria, s.min_gpa],
      );
    }
  }
  return { university_id: universityId, course_ids: courseIds };
}

export async function down(ds: DataSource): Promise<Record<string, number>> {
  // Counted by SELECT before each DELETE: for a DELETE, the pg driver hands
  // back `[rows, rowCount]`, so reading `.length` off the result reported "2"
  // for every table no matter how many rows went.
  const count = async (sql: string, params: unknown[]): Promise<number> =>
    Number((await ds.query(sql, params))[0].n);

  // `student_profile.student_id` is a VARCHAR with no foreign key, so profiles
  // do NOT cascade when their student is deleted — the catalogue already
  // carries 290 orphans from earlier QA batches this way. The fixture cleans up
  // its own rather than adding to them.
  const studentIds: { id: string }[] = await ds.query(
    `SELECT id FROM "student" WHERE branch = $1`, [HAPPY_PATH_MARK]);
  let profiles = 0;
  if (studentIds.length) {
    profiles = await count(
      `WITH d AS (DELETE FROM "student_profile" WHERE student_id = ANY($1::text[]) RETURNING 1)
       SELECT count(*) AS n FROM d`,
      [studentIds.map((s) => s.id)],
    );
  }

  // Scholarships and course_campus rows DO cascade from course (real FKs), and
  // courses cascade from university.
  const courses = await count(
    `WITH d AS (DELETE FROM "course" WHERE source_note = $1 RETURNING 1) SELECT count(*) AS n FROM d`,
    [HAPPY_PATH_MARK]);
  const students = await count(
    `WITH d AS (DELETE FROM "student" WHERE branch = $1 RETURNING 1) SELECT count(*) AS n FROM d`,
    [HAPPY_PATH_MARK]);
  const universities = await count(
    `WITH d AS (DELETE FROM "university" WHERE cricos_provider_code = $1 RETURNING 1) SELECT count(*) AS n FROM d`,
    [FIXTURE_PROVIDER_CODE]);
  const policies = await count(
    `WITH d AS (DELETE FROM "admission_policy" WHERE key = $1 RETURNING 1) SELECT count(*) AS n FROM d`,
    [FIXTURE_POLICY_KEY]);

  return { courses, students, profiles, universities, policies };
}

if (require.main === module) {
  (async () => {
    const ds = await AppDataSource.initialize();
    try {
      if (process.argv.includes('--down')) {
        console.log('removed:', await down(ds));
      } else {
        const out = await up(ds);
        console.log(`fixture up: university ${out.university_id}`);
        for (const [k, v] of Object.entries(out.course_ids)) console.log(`  ${k.padEnd(12)} ${v}`);
      }
    } finally {
      await ds.destroy();
    }
  })().catch((e) => { console.error(e); process.exit(1); });
}
