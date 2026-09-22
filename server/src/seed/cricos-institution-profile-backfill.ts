// ---------------------------------------------------------------------------
// Non-destructive backfill of real CRICOS registry profile fields onto
// EXISTING `university` rows (PRODUCT_PLAN phase 9) — provider code,
// institution type, capacity, website, address. Source:
// data/cricos/institutions.csv (the same official data.gov.au CRICOS
// snapshot src/seed/cricos-import.ts already uses for course data — see
// data/cricos/README.md for provenance). Matches by exact `Institution Name`
// against rows already in the DB and UPDATEs only the five new columns —
// unlike cricos-import.ts, this never deletes or recreates a university row.
// Idempotent — safe to re-run.
//
// Run with: npx ts-node -r tsconfig-paths/register src/seed/cricos-institution-profile-backfill.ts
// ---------------------------------------------------------------------------

import 'reflect-metadata';
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';
import { DataSource, IsNull } from 'typeorm';
import { dataSourceOptions } from '../config/data-source';
import { University } from '../modules/university/university.entity';

const DATA_DIR = join(__dirname, '..', '..', 'data', 'cricos');

async function main() {
  const ds = new DataSource(dataSourceOptions);
  await ds.initialize();
  console.log('Connected. Backfilling real CRICOS institution-profile fields onto existing universities...');

  const uniRepo = ds.getRepository(University);
  const institutions: any[] = parse(readFileSync(join(DATA_DIR, 'institutions.csv')), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });

  const allUnis = await uniRepo.find();
  const byName = new Map(allUnis.map((u) => [u.name.trim().toLowerCase(), u]));

  let matched = 0;
  for (const inst of institutions) {
    const name = String(inst['Institution Name'] ?? '').trim();
    const uni = byName.get(name.toLowerCase());
    if (!uni) {
      console.log(`  no existing university row named "${name}" — skipping`);
      continue;
    }
    await uniRepo.update(uni.id, {
      cricos_provider_code: inst['CRICOS Provider Code'] || null,
      institution_type: inst['Institution Type'] || null,
      student_capacity: inst['Institution Capacity'] ? Number(String(inst['Institution Capacity']).replace(/,/g, '')) || null : null,
      website: inst['Website'] || null,
      address: [inst['Postal Address Line 1'], inst['Postal Address City'], inst['Postal Address State'], inst['Postal Address Postcode']]
        .filter(Boolean)
        .join(', ') || null,
    });
    matched++;
  }
  console.log(`  university: ${matched}/${institutions.length} rows backfilled with real CRICOS profile data`);

  const stillMissing = await uniRepo.count({ where: { cricos_provider_code: IsNull() } });
  console.log(`  ${stillMissing} universities still have no CRICOS provider code on file (not in this trimmed snapshot) — real gaps, not a bug.`);

  await ds.destroy();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
