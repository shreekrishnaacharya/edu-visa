// ---------------------------------------------------------------------------
// Seeds the Australia-only catalogue + reference tables + demo users + the
// prototype's student fixtures, reusing the frontend's fixtures VERBATIM
// (../../../frontend/src/mocks/db/*) so the backend and the prototype start from
// identical data — see the golden engine test for why that matters.
// ---------------------------------------------------------------------------

import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import * as argon2 from 'argon2';
import { dataSourceOptions } from '../config/data-source';
import { University } from '../modules/university/university.entity';
import { Course } from '../modules/course/course.entity';
import { Student } from '../modules/student/entities/student.entity';
import { StudentProfile } from '../modules/profile/student-profile.entity';
import { FollowUp } from '../modules/follow-up/follow-up.entity';
import { FxRate } from '../modules/reference/fx-rate.entity';
import { User } from '../modules/auth/user.entity';
import { Role } from '../common/enums';
import { applyAggregate, toEngineStudent } from '../modules/student/student.mapper';
import { deriveProfile } from '../modules/match/engine/derive';

// Frontend fixtures — reused verbatim (PRODUCT_PLAN §0 prototype/production
// split). The frontend package is ESM (`"type": "module"`), so these load via
// dynamic import() inside main() rather than require().

async function main() {
  const { universities: uniFixtures } = await import('../../../frontend/src/mocks/db/universities');
  const { courses: courseFixtures } = await import('../../../frontend/src/mocks/db/courses');
  const { students: studentFixtures } = await import('../../../frontend/src/mocks/db/students');
  const { followUps: followUpFixtures } = await import('../../../frontend/src/mocks/db/follow-ups');
  const { FX_TO_AUD } = await import('../../../frontend/src/mocks/db/reference');

  const ds = new DataSource(dataSourceOptions);
  await ds.initialize();
  console.log('Connected. Seeding Australia-only catalogue + fixtures...');

  const uniRepo = ds.getRepository(University);
  const courseRepo = ds.getRepository(Course);
  const studentRepo = ds.getRepository(Student);
  const profileRepo = ds.getRepository(StudentProfile);
  const followUpRepo = ds.getRepository(FollowUp);
  const fxRepo = ds.getRepository(FxRate);
  const userRepo = ds.getRepository(User);

  // --- reference: FX table ---------------------------------------------
  await fxRepo.save(
    Object.entries(FX_TO_AUD).map(([currency, to_aud]) => ({
      currency: currency as FxRate['currency'],
      to_aud: to_aud as number,
    })),
  );
  console.log(`  fx_rate: ${Object.keys(FX_TO_AUD).length} rows`);

  // --- Side B: AU-only universities + courses ---------------------------
  const auUnis = uniFixtures.filter((u: any) => u.country === 'AU');
  const auUniIds = new Set(auUnis.map((u: any) => u.id));
  const auCourses = courseFixtures.filter((c: any) => auUniIds.has(c.university_id));

  const uniIdMap = new Map<string, string>(); // fixture id -> real uuid
  for (const u of auUnis) {
    const saved = await uniRepo.save(
      uniRepo.create({
        name: u.name,
        country: u.country,
        city: u.city,
        world_rank: u.world_rank,
        logo_hue: u.logo_hue,
        verified_at: new Date(),
      }),
    );
    uniIdMap.set(u.id, saved.id);
  }
  console.log(`  university: ${uniIdMap.size} rows (AU only)`);

  let courseCount = 0;
  for (const c of auCourses) {
    await courseRepo.save(
      courseRepo.create({
        university_id: uniIdMap.get(c.university_id)!,
        university_name: c.university_name,
        country: c.country,
        city: c.city,
        world_rank: c.world_rank,
        title: c.title,
        degree_level: c.degree_level,
        field: c.field,
        duration_months: c.duration_months,
        tuition_fee: c.tuition_fee,
        currency: c.currency,
        intakes: c.intakes,
        next_intake_date: c.next_intake_date,
        application_deadline: c.application_deadline,
        entry: c.entry,
        scholarships: c.scholarships.map((s: any) => ({ name: s.name, pct: s.pct, criteria: s.criteria, min_gpa: s.min_gpa })),
        career_outcomes: c.career_outcomes,
        cricos: c.cricos,
        verified_at: new Date(),
      }),
    );
    courseCount++;
  }
  console.log(`  course: ${courseCount} rows (AU only)`);

  // --- demo users --------------------------------------------------------
  const password_hash = await argon2.hash('password123');
  const [superAdmin, counsellorUser, branchAdmin] = await userRepo.save([
    userRepo.create({ email: 'admin@edu-visa.local', password_hash, full_name: 'System Admin', role: Role.SuperAdmin, permissions: ['visa:read'] }),
    userRepo.create({ email: 'bina.rai@edu-visa.local', password_hash, full_name: 'Bina Rai', role: Role.Counsellor, branch: 'Kathmandu HQ' }),
    userRepo.create({ email: 'branch.admin@edu-visa.local', password_hash, full_name: 'Branch Admin', role: Role.BranchAdmin, branch: 'Kathmandu HQ' }),
  ]);
  console.log(`  app_user: 3 rows (password for all: "password123")`);

  // --- Side A: student fixtures (all of them — students aren't country-scoped) --
  const studentIdMap = new Map<string, string>(); // fixture id -> real uuid
  for (const s of studentFixtures as any[]) {
    const entity = studentRepo.create();
    applyAggregate(entity, {
      ...s,
      counsellor: s.counsellor,
    });
    entity.branch = s.branch;
    entity.counsellor_id = s.counsellor === 'Bina Rai' ? counsellorUser.id : null;
    const saved = await studentRepo.save(entity);
    studentIdMap.set(s.id, saved.id);

    const full = await studentRepo.findOneOrFail({
      where: { id: saved.id },
      relations: {
        academic: true,
        language_tests: true,
        work: true,
        career_goal: true,
        income_sources: true,
        assets: true,
        liabilities: true,
        sponsors: true,
        visa_history: true,
        dependants: true,
        preferences: true,
      },
    });
    const engineStudent = toEngineStudent(full);
    const derived = deriveProfile(engineStudent, 1, FX_TO_AUD);
    await profileRepo.save(profileRepo.create({ ...derived }));
  }
  console.log(`  student: ${studentIdMap.size} rows (+ v1 student_profile each)`);

  // --- follow-ups (remap fixture student ids) ----------------------------
  let followUpCount = 0;
  for (const f of followUpFixtures as any[]) {
    const student_id = studentIdMap.get(f.student_id);
    if (!student_id) continue;
    await followUpRepo.save(
      followUpRepo.create({ student_id, kind: f.kind, body: f.body, author: f.author, attachments: [] }),
    );
    followUpCount++;
  }
  console.log(`  follow_up: ${followUpCount} rows`);

  await ds.destroy();
  console.log('Seed complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
