import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { MatchService } from './src/modules/match/match.service';
import { DataSource } from 'typeorm';

(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const ds = app.get(DataSource);
  const svc = app.get(MatchService);

  const gpaCourses: { id: string }[] = await ds.query(
    `select id from course where (entry->>'min_gpa') is not null`);
  const gpaIds = new Set(gpaCourses.map((c) => c.id));
  const students: { id: string; full_name: string }[] = await ds.query(
    `select s.id, s.full_name from student s order by s.created_at limit 30`);

  let runs = 0, hits = 0, topHit = 0, slots = 0;
  for (const st of students) {
    const run = await svc.run(st.id, { persist: false, limit: 8 });
    const top = run.results;
    if (!top.length) continue;
    runs++;
    slots += top.length;
    const n = top.filter((r: any) => gpaIds.has(r.course_id)).length;
    hits += n;
    if (gpaIds.has((top[0] as any).course_id)) topHit++;
  }
  console.log(`students sampled      : ${runs}`);
  console.log(`the 9 aggregator rows : ${hits} of ${slots} recommendation slots (${((hits/slots)*100).toFixed(1)}%)`);
  console.log(`ranked #1             : ${topHit} of ${runs} students (${((topHit/runs)*100).toFixed(1)}%)`);
  console.log(`(they are 9 of 12,758 courses = 0.07% of the catalogue)`);
  await app.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
