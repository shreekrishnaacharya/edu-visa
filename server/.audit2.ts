import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { MatchService } from './src/modules/match/match.service';
import { DataSource } from 'typeorm';

(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const ds = app.get(DataSource);
  const svc = app.get(MatchService);
  const [st] = await ds.query(`select id, full_name from student order by created_at limit 1`);

  // How many distinct verdict cache keys a single run builds (each costs 2 queries).
  const keys = await ds.query(`
    select count(distinct (u.policy_key||':'||c.degree_level||':'||c.title||':'||c.field)) as keys,
           count(*) as policy_linked_courses
    from course c join university u on u.id=c.university_id where u.policy_key is not null`);
  console.log('verdict cache keys per run:', keys[0]);

  const run = await svc.run(st.id, { persist: false, limit: 20000 });
  const all = run.results;
  console.log(`\n${st.full_name}: ${all.length} returned`);

  // Re-run with the gate off to see what eligibility enforcement actually removes.
  const off = await svc.run(st.id, { persist: false, limit: 20000, enforceAdmissionEligibility: false });
  console.log('ranked with gate ON :', all.length);
  console.log('ranked with gate OFF:', off.results.length);

  // Verdict mix among returned rows
  const mix: Record<string, number> = {};
  const src: Record<string, number> = {};
  for (const r of off.results as any[]) {
    mix[r.admission_eligibility.overall] = (mix[r.admission_eligibility.overall] ?? 0) + 1;
    src[r.admission_eligibility.source] = (src[r.admission_eligibility.source] ?? 0) + 1;
  }
  console.log('verdict mix :', JSON.stringify(mix));
  console.log('verdict source:', JSON.stringify(src));

  // What the narrative looks like on the single best row
  const top: any = all[0];
  console.log('\n--- top row narrative ---');
  console.log('why      :', JSON.stringify(top.why, null, 1));
  console.log('concerns :', JSON.stringify(top.concerns, null, 1));
  console.log('missing  :', JSON.stringify(top.missing_info, null, 1));
  console.log('scholarship_potential:', top.scholarship_potential, '| opportunities:', top.scholarship_opportunities.length);
  console.log('alternatives:', JSON.stringify(top.alternatives));
  await app.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
