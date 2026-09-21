// ---------------------------------------------------------------------------
// One real course per institution for the 9 admission-policy institutions
// (server/src/modules/admission/admission-policy.data.ts) that have zero
// presence in the CRICOS-sourced catalogue — added so /match/* and
// /deadlines can be exercised against them (they previously only worked via
// the separate admission-eligibility layer + RAG citations).
//
// PROVENANCE: every official .edu.au page/fee-PDF tried for these 9 (UTAS,
// SCU, CQU, Torrens, Newcastle — 5 of 9 tested directly) returned HTTP 403 on
// automated fetch. The only fetchable sources were third-party aggregators
// (Mastersportal, Shiksha, Collegedunia, ApplyBoard, IDP, ...), which
// disagreed with each other by up to 18% on the same course (e.g. SCU's MBA:
// AUD 30,400 vs 31,920 vs 36,320 depending on source page). That fails this
// codebase's own trust model for the Tier-1 catalogue ("every fact
// re-checked against a .edu.au or government page before it enters Tier 1" —
// plan appendix A), so every row here is written with
// `data_confidence: 'unverified_aggregator'` and a `source_note` recording
// where the figure came from — OrchestratorService cites these with an
// honest "not yet verified, treat as approximate" tag instead of the
// "OUR CATALOGUE — authoritative" tag real CRICOS rows get. See per-course
// `source_note` below for the specific search/page each figure came from.
// ---------------------------------------------------------------------------

import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../config/data-source';
import { University } from '../modules/university/university.entity';
import { Course } from '../modules/course/course.entity';
import { DegreeLevel } from '../common/enums';
import { EntryRequirement } from '../modules/course/entry-requirement';

interface Row {
  institution: string;
  /** admission-policy.data.ts key — links this catalogue row to its real eligibility rules (PRODUCT_PLAN phase 4). */
  policy_key: string;
  city: string;
  logo_hue: number;
  title: string;
  degree_level: DegreeLevel;
  field: string;
  duration_months: number;
  tuition_fee: number;
  cricos: string;
  source_note: string;
}

const ENTRY: EntryRequirement = {
  min_gpa: 48,
  min_english_band: 6.0,
  accepted_tests: ['IELTS', 'PTE', 'TOEFL'],
  prerequisites: [],
  work_experience_months: 0,
};

const ROWS: Row[] = [
  {
    institution: 'University of Tasmania (UTAS)',
    policy_key: 'utas',
    city: 'Hobart',
    logo_hue: 30,
    title: 'Master of Information Technology and Systems',
    degree_level: 'Master',
    field: 'Information Technology',
    duration_months: 24,
    tuition_fee: 39966,
    cricos: '079193M',
    source_note:
      'Aggregator search (ApplyBoard / Good Universities Guide); utas.edu.au returned HTTP 403 on automated fetch. Source figure AUD 79,931 total over 2yr, halved here for an annual figure.',
  },
  {
    institution: 'Sydney Met (formerly MIT Sydney)',
    policy_key: 'sydney-met',
    city: 'Sydney',
    logo_hue: 205,
    title: 'Master of Information Technology',
    degree_level: 'Master',
    field: 'Information Technology',
    duration_months: 24,
    tuition_fee: 46400,
    cricos: '117055B',
    source_note:
      'Aggregator search (cheapestcollege.com.au) — course-level CRICOS 117055B found there. Source phrased fee as "from $46,400"; ambiguous whether annual or total, treated as annual here — needs confirming.',
  },
  {
    institution: 'University of Newcastle (UON)',
    policy_key: 'newcastle',
    city: 'Newcastle',
    logo_hue: 260,
    title: 'Master of Information Technology',
    degree_level: 'Master',
    field: 'Information Technology',
    duration_months: 24,
    tuition_fee: 47600,
    cricos: '00109J',
    source_note:
      'newcastle.edu.au fee pages and PDFs returned HTTP 403 on automated fetch (WebFetch and direct curl). 00109J is the institution-level CRICOS provider code, not course-specific — no course-level code found. Fee from aggregator search (Yocket/Collegedunia), figure labelled "2026".',
  },
  {
    institution: 'Torrens University',
    policy_key: 'torrens-blue-mountains',
    city: 'Adelaide',
    logo_hue: 12,
    title: 'Master of Business Administration (Advanced)',
    degree_level: 'Master',
    field: 'Business',
    duration_months: 24,
    tuition_fee: 31400,
    cricos: '088149G',
    source_note:
      'Aggregator search (collegedunia), source labelled "December 2024 data". Official torrens.edu.au international fee-schedule PDFs exist but were not directly fetchable.',
  },
  {
    institution: 'Southern Cross University (SCU)',
    policy_key: 'scu',
    city: 'Lismore',
    logo_hue: 145,
    title: 'Master of Business Administration',
    degree_level: 'Master',
    field: 'Business',
    duration_months: 24,
    tuition_fee: 31920,
    cricos: '01241G',
    source_note:
      'Course-level CRICOS not resolved (scu.edu.au course search is JS-rendered, not fetchable). 01241G is the confirmed institution-level CRICOS provider code (from the official scu.edu.au "International courses and fees" page, which loaded but without course-level fee data). Fee aggregator figures ranged AUD 30,400-36,320 across sources (Lismore vs Sydney campus) — used the AUD 31,920 first-year figure.',
  },
  {
    institution: 'ACAP (Australian College of Applied Psychology) University College — Navitas',
    policy_key: 'acap-navitas',
    city: 'Sydney',
    logo_hue: 290,
    title: 'Master of Counselling and Psychotherapy',
    degree_level: 'Master',
    field: 'Counselling / Psychology',
    duration_months: 24,
    tuition_fee: 30472,
    cricos: '01328A',
    source_note:
      'Course-level CRICOS not resolved (01328A is the institution-level provider code). Fee from aggregator search (IDP listing / Shiksha), first-year figure.',
  },
  {
    institution: 'Excelsia College',
    policy_key: 'excelsia',
    city: 'Sydney',
    logo_hue: 330,
    title: 'Bachelor of Business (Accounting)',
    degree_level: 'Bachelor',
    field: 'Business / Accounting',
    duration_months: 36,
    tuition_fee: 16400,
    cricos: '106164K',
    source_note:
      'Aggregator search (hotcoursesabroad.com/india); course-level CRICOS 106164K found there. Source figure AUD 8,200/semester, doubled here for an annual figure.',
  },
  {
    institution: 'Central Queensland University (CQU)',
    policy_key: 'cqu',
    city: 'Rockhampton',
    logo_hue: 55,
    title: 'Master of Business Administration',
    degree_level: 'Master',
    field: 'Business',
    duration_months: 24,
    tuition_fee: 38640,
    cricos: '00219C',
    source_note:
      'cqu.edu.au fees page returned HTTP 403 on automated fetch. 00219C is the institution-level CRICOS provider code — no course-level code found. Fee figures varied AUD 34,920-38,640 across aggregator sources (collegedunia/mastersportal/shiksha) depending on MBA variant/mode; used the AUD 38,640 per-year figure.',
  },
  {
    institution: 'Curtin College',
    policy_key: 'curtin-griffith-eynesbury',
    city: 'Perth',
    logo_hue: 165,
    title: 'Diploma of Commerce',
    degree_level: 'Bachelor',
    field: 'Business / Commerce',
    duration_months: 12,
    tuition_fee: 27800,
    cricos: '087940C',
    source_note:
      'Undergraduate PATHWAY diploma (feeds into 2nd year of a Curtin University Bachelor) — mapped to the "Bachelor" degree_level bucket since this schema has no pathway/diploma-specific level; not a real Bachelor\'s degree. Fee/CRICOS from aggregator search (ApplyBoard), first-year figure.',
  },
];

function isoInMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const ds = new DataSource(dataSourceOptions);
  await ds.initialize();
  console.log('Connected. Seeding unverified-aggregator research rows for the 9 admission-policy institutions...');

  const uniRepo = ds.getRepository(University);
  const courseRepo = ds.getRepository(Course);

  let uniCount = 0;
  let courseCount = 0;
  for (const row of ROWS) {
    let uni = await uniRepo.findOne({ where: { name: row.institution } });
    if (!uni) {
      uni = await uniRepo.save(
        uniRepo.create({
          name: row.institution,
          policy_key: row.policy_key,
          country: 'AU',
          city: row.city,
          world_rank: 999,
          logo_hue: row.logo_hue,
          verified_at: null, // never re-verified — this row IS the unverified data
        }),
      );
      uniCount++;
    } else if (uni.policy_key !== row.policy_key) {
      // Backfill for universities seeded before `policy_key` existed — idempotent, re-run-safe.
      await uniRepo.update(uni.id, { policy_key: row.policy_key });
    }

    const existing = await courseRepo.findOne({ where: { university_id: uni.id, title: row.title } });
    if (existing) continue; // idempotent re-run

    await courseRepo.save(
      courseRepo.create({
        university_id: uni.id,
        university_name: row.institution,
        country: 'AU',
        city: row.city,
        world_rank: 999,
        title: row.title,
        degree_level: row.degree_level,
        field: row.field,
        duration_months: row.duration_months,
        tuition_fee: row.tuition_fee,
        currency: 'AUD',
        intakes: ['Feb', 'Jul'],
        next_intake_date: isoInMonths(3),
        application_deadline: isoInMonths(1),
        entry: ENTRY,
        career_outcomes: [],
        cricos: row.cricos,
        verified_at: null,
        data_confidence: 'unverified_aggregator',
        source_note: row.source_note,
      }),
    );
    courseCount++;
  }

  console.log(`  university: ${uniCount} new rows, course: ${courseCount} new rows (unverified_aggregator)`);
  await ds.destroy();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
