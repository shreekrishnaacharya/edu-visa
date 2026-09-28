import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { MatchService } from './src/modules/match/match.service';
import { DataSource } from 'typeorm';

function stats(xs: number[]) {
  const n = xs.length;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  return { mean: +mean.toFixed(2), sd: +sd.toFixed(2), distinct: new Set(xs).size };
}

(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const ds = app.get(DataSource);
  const svc = app.get(MatchService);

  const students: { id: string; full_name: string }[] = await ds.query(
    `select id, full_name from student order by created_at limit 5`,
  );

  for (const st of students) {
    const t0 = Date.now();
    // limit high enough to get every scored, non-knocked-out course back
    const run = await svc.run(st.id, { persist: false, limit: 20000 });
    const ms = Date.now() - t0;
    const rs = run.results;
    const dims = ['academic', 'english', 'financial', 'career', 'location', 'scholarship'] as const;

    console.log(`\n===== ${st.full_name} (${rs.length} ranked, ${ms}ms) =====`);
    for (const d of dims) {
      const s = stats(rs.map((r: any) => r.subscores[d]));
      console.log(`  ${d.padEnd(12)} mean=${String(s.mean).padStart(6)} sd=${String(s.sd).padStart(6)} distinct=${s.distinct}`);
    }
    const ov = stats(rs.map((r: any) => r.overall));
    console.log(`  ${'OVERALL'.padEnd(12)} mean=${String(ov.mean).padStart(6)} sd=${String(ov.sd).padStart(6)} distinct=${ov.distinct}`);
    console.log(`  top overall=${Math.max(...rs.map((r: any) => r.overall))} bottom=${Math.min(...rs.map((r: any) => r.overall))}`);
    const tiers = rs.reduce((m: any, r: any) => ((m[r.tier] = (m[r.tier] ?? 0) + 1), m), {});
    console.log('  tiers:', JSON.stringify(tiers));
    console.log('  top 5:');
    for (const r of rs.slice(0, 5)) {
      const c: any = await ds.query(`select title, field, degree_level, tuition_fee from course where id=$1`, [r.course_id]);
      console.log(`    ${r.overall}%  ${c[0].degree_level} ${c[0].title} [${c[0].field}] AUD ${c[0].tuition_fee}`);
    }
  }
  await app.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
