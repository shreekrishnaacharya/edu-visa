// ---------------------------------------------------------------------------
// One-time seed of the 9 originally hand-typed AdmissionPolicy entries
// (../modules/admission/admission-policy.data.ts) into the new
// `admission_policy` table (PRODUCT_PLAN phase 7) — that file is no longer
// read at runtime after this, only used here as the seed source. Idempotent
// (upsert by key) — safe to re-run.
//
// Run with: npx ts-node -r tsconfig-paths/register src/seed/seed-admission-policies.ts
// ---------------------------------------------------------------------------

import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../config/data-source';
import { AdmissionPolicyEntity } from '../modules/admission/admission-policy.entity';
import { ADMISSION_POLICIES } from '../modules/admission/admission-policy.data';

async function main() {
  const ds = new DataSource(dataSourceOptions);
  await ds.initialize();
  console.log('Connected. Seeding the 9 hand-typed admission policies into admission_policy...');

  const repo = ds.getRepository(AdmissionPolicyEntity);
  let count = 0;
  for (const policy of ADMISSION_POLICIES) {
    await repo.save(
      repo.create({
        key: policy.key,
        institution: policy.institution,
        data: policy,
        source_document_id: null,
        review_status: 'reviewed',
      }),
    );
    count++;
  }

  console.log(`  admission_policy: ${count} rows upserted (review_status: reviewed)`);
  await ds.destroy();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
