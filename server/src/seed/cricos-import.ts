// ---------------------------------------------------------------------------
// Replaces the synthetic AU course catalogue with REAL data from the
// Australian Government's CRICOS register (data.gov.au) — see
// server/data/cricos/README.md for provenance. Real institutions, real
// course titles, real fees. Entry requirements/scholarships are NOT in
// CRICOS data — filled with documented estimated defaults by course level.
// ---------------------------------------------------------------------------

import 'reflect-metadata';
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../config/data-source';
import { University } from '../modules/university/university.entity';
import { Course } from '../modules/course/course.entity';
import { DegreeLevel } from '../common/enums';

const DATA_DIR = join(__dirname, '..', '..', 'data', 'cricos');

// city / world_rank aren't in CRICOS data — reused from the original curated
// seed (public QS-rank-derived values), keyed by the real CRICOS provider code.
const UNI_META: Record<string, { city: string; world_rank: number; logo_hue: number }> = {
  '00116K': { city: 'Melbourne', world_rank: 13, logo_hue: 220 }, // University of Melbourne
  '00026A': { city: 'Sydney', world_rank: 19, logo_hue: 8 }, // University of Sydney
  '00008C': { city: 'Melbourne', world_rank: 37, logo_hue: 268 }, // Monash
  '00025B': { city: 'Brisbane', world_rank: 40, logo_hue: 200 }, // UQ
  '00098G': { city: 'Sydney', world_rank: 19, logo_hue: 340 }, // UNSW
  '00126G': { city: 'Perth', world_rank: 77, logo_hue: 150 }, // UWA
  '00113B': { city: 'Geelong', world_rank: 233, logo_hue: 24 }, // Deakin
  '00122A': { city: 'Melbourne', world_rank: 140, logo_hue: 0 }, // RMIT
};

const LEVEL_MAP: Record<string, DegreeLevel> = {
  'Bachelor Degree': 'Bachelor',
  'Bachelor Honours Degree': 'Bachelor',
  'Graduate Certificate': 'PG Diploma',
  'Graduate Diploma': 'PG Diploma',
  'Masters Degree (Coursework)': 'Master',
  'Masters Degree (Research)': 'Master',
  'Masters Degree (Extended)': 'Master',
  'Doctoral Degree': 'PhD',
};

// Documented estimates — NOT sourced from CRICOS (see data/cricos/README.md).
// A single flat GPA bar per degree level, applied uniformly across all 8
// universities, was the first cut and was unrealistic: real entry
// selectivity varies a lot by institution, not just by level (a Go8
// research-intensive university's Master's bar is genuinely higher than a
// large, broad-access university's). Tiered by world_rank, which we already
// hold per institution, so a weaker-but-real transcript can still clear the
// bar somewhere in the catalogue instead of being locked out of all 8
// universities by one flat number.
type Tier = 'selective' | 'moderate' | 'accessible';

function entryDefaults(level: DegreeLevel, worldRank: number) {
  const tier: Tier = worldRank <= 40 ? 'selective' : worldRank <= 150 ? 'moderate' : 'accessible';
  const table: Record<Tier, Record<DegreeLevel, { min_gpa: number; min_english_band: number }>> = {
    selective: {
      Bachelor: { min_gpa: 58, min_english_band: 6.5 },
      'PG Diploma': { min_gpa: 58, min_english_band: 6.5 },
      Master: { min_gpa: 65, min_english_band: 6.5 },
      PhD: { min_gpa: 75, min_english_band: 6.5 },
    },
    moderate: {
      Bachelor: { min_gpa: 50, min_english_band: 6.0 },
      'PG Diploma': { min_gpa: 50, min_english_band: 6.0 },
      Master: { min_gpa: 58, min_english_band: 6.5 },
      PhD: { min_gpa: 70, min_english_band: 6.5 },
    },
    accessible: {
      Bachelor: { min_gpa: 42, min_english_band: 6.0 },
      'PG Diploma': { min_gpa: 42, min_english_band: 6.0 },
      Master: { min_gpa: 52, min_english_band: 6.5 },
      PhD: { min_gpa: 65, min_english_band: 6.5 },
    },
  };
  return { ...table[tier][level], work_experience_months: 0 };
}

function parseMoney(s: string): number {
  return Math.round(parseFloat(String(s).replace(/[^0-9.]/g, '')) || 0);
}

function cleanField(s: string): string {
  // "0905 - Human Welfare Studies and Services" -> "Human Welfare Studies and Services"
  return (s || '').replace(/^\d+\s*-\s*/, '').trim();
}

function isoInMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const ds = new DataSource(dataSourceOptions);
  await ds.initialize();
  console.log('Connected. Replacing synthetic AU catalogue with real CRICOS data...');

  const uniRepo = ds.getRepository(University);
  const courseRepo = ds.getRepository(Course);

  const institutions: any[] = parse(readFileSync(join(DATA_DIR, 'institutions.csv')), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });
  const courses: any[] = parse(readFileSync(join(DATA_DIR, 'courses.csv')), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });

  // Wipe the old synthetic AU catalogue (cascades to scholarship/course_intake).
  const oldCourses = await courseRepo.count({ where: { country: 'AU' } });
  await courseRepo.delete({ country: 'AU' });
  const oldUnis = await uniRepo.count({ where: { country: 'AU' } });
  await uniRepo.delete({ country: 'AU' });
  console.log(`  removed ${oldUnis} synthetic universities, ${oldCourses} synthetic courses`);

  const uniIdByCode = new Map<string, string>();
  for (const inst of institutions) {
    const code = inst['CRICOS Provider Code'];
    const meta = UNI_META[code];
    if (!meta) continue;
    const saved = await uniRepo.save(
      uniRepo.create({
        name: inst['Institution Name'],
        country: 'AU',
        city: meta.city,
        world_rank: meta.world_rank,
        logo_hue: meta.logo_hue,
        verified_at: new Date(),
      }),
    );
    uniIdByCode.set(code, saved.id);
  }
  console.log(`  university: ${uniIdByCode.size} rows (real CRICOS institutions)`);

  let imported = 0,
    skipped = 0;
  const batch: Partial<Course>[] = [];
  for (const row of courses) {
    const code = row['CRICOS Provider Code'];
    const universityId = uniIdByCode.get(code);
    const level = LEVEL_MAP[row['Course Level']];
    const weeks = parseFloat(row['Duration (Weeks)']);
    const totalFee = parseMoney(row['Tuition Fee']);
    // Some joint/partner-institution research degrees (e.g. "Doctor of
    // Philosophy (Beihang - Monash)") show a $0-$1 fee in this field because
    // tuition is billed by the partner institution, not disclosed here —
    // real CRICOS-registered AU courses, but not a real domestic price.
    // `Dual Qualification` doesn't reliably flag these, so a realistic floor
    // catches the artifact instead.
    const MIN_REALISTIC_FEE = 3000;
    if (!universityId || !level || !weeks || totalFee < MIN_REALISTIC_FEE) {
      skipped++;
      continue;
    }
    const years = weeks / 52;
    const tuitionPerYear = Math.round(totalFee / Math.max(years, 0.25));
    const field =
      cleanField(row['Field of Education 1 Detailed Field']) ||
      cleanField(row['Field of Education 1 Narrow Field']) ||
      cleanField(row['Field of Education 1 Broad Field']) ||
      'General';
    const meta = UNI_META[code];
    const defaults = entryDefaults(level, meta.world_rank);

    batch.push({
      university_id: universityId,
      university_name: row['Institution Name'],
      country: 'AU',
      city: meta.city,
      world_rank: meta.world_rank,
      title: row['Course Name'],
      degree_level: level,
      field,
      duration_months: Math.max(1, Math.round(weeks / 4.345)),
      tuition_fee: tuitionPerYear,
      currency: 'AUD',
      intakes: ['Feb', 'Jul'],
      // CRICOS doesn't carry live intake dates — reasonable forward-looking
      // estimates (flagged as such in the report, not presented as sourced).
      next_intake_date: isoInMonths(row['Course Level'].includes('Doctoral') ? 6 : 3),
      application_deadline: isoInMonths(row['Course Level'].includes('Doctoral') ? 4 : 1),
      entry: {
        min_gpa: defaults.min_gpa,
        min_english_band: defaults.min_english_band,
        accepted_tests: ['IELTS', 'PTE', 'TOEFL'],
        prerequisites: [],
        work_experience_months: defaults.work_experience_months,
      },
      career_outcomes: [],
      cricos: row['CRICOS Course Code'],
      verified_at: new Date(),
    });
    imported++;
  }

  // batch insert (save() in chunks — thousands of rows)
  for (let i = 0; i < batch.length; i += 200) {
    await courseRepo.save(batch.slice(i, i + 200));
  }

  console.log(`  course: ${imported} rows imported (real CRICOS), ${skipped} skipped (no fee/duration/unmapped level)`);
  await ds.destroy();
  console.log('CRICOS import complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
