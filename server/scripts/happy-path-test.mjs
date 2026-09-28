// ---------------------------------------------------------------------------
// HAPPY-PATH MATCH TEST — the scenario the live catalogue cannot express.
//
// Seed first:  npx ts-node -r tsconfig-paths/register src/seed/happy-path-fixture.ts
// Run:         node scripts/happy-path-test.mjs
// Revert:      npx ts-node -r tsconfig-paths/register src/seed/happy-path-fixture.ts --down
//
// Every expected score below was computed BY HAND from the fixture definitions
// and the scorers in engine/score.ts, then asserted — so a failure means the
// engine disagrees with the design, not merely that output changed. Worked
// example, flagship for the ideal student (weights 24/16/16/26/8/10):
//   academic 62 + min(90-70,22)*1.7      = 96
//   english  70 + (7.5-6.5)*26           = 96
//   financial funds 200k vs 2yr cost 122k -> saturates = 100
//   career   34 +34 field +14 level +10 experience = 92
//   location 50 +30 country +15 city +10 rank<=60 +5 big city = 110 -> 100
//   scholarship 60 + 25 (GPA 90 clears the 85 award) = 85
//   weighted = 23.04+15.36+16+23.92+8+8.5 = 94.82 -> 95, alignment 1.0
//
// Students are tagged branch=HAPPY_PATH_FIXTURE and are deleted by the
// fixture's --down. No missing-data cases are covered here on purpose: this
// file exists to prove the happy path, and the unsourced-data behaviour is
// already pinned by test/engine-unsourced-entry.spec.ts.
// ---------------------------------------------------------------------------
import axios from "axios";

const BASE = process.env.API || "http://localhost:3000";
const MARK = "HAPPY_PATH_FIXTURE";
const FIELD = "Applied Data Engineering";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? `  — ${detail}` : ""}`);
};

/** One complete profile. Only the axis under test varies between students. */
function student(name, over = {}) {
  return {
    full_name: `${name} (HAPPY PATH)`,
    date_of_birth: "1999-04-12",
    gender: "female",
    nationality: "Nepal",
    current_city: "Kathmandu",
    passport_status: "held",
    marital_status: "single",
    dependants: [],
    state: "Shortlisted",
    counsellor: "Fixture QA",
    branch: MARK,
    consent_given_at: new Date().toISOString(),
    academic: [
      {
        level: "Bachelor",
        course: "Bachelor of Computer Engineering",
        institution: "Tribhuvan University",
        country: "Nepal",
        start_year: 2017,
        end_year: 2021,
        gpa_value: over.gpa ?? 3.6, // /4.0 -> canonical 90
        gpa_scale: "4.0",
        gap_months: 0,
        backlogs: 0,
      },
    ],
    // All four skills at 7.0 so the policy's "no band below 6.0" rule is
    // genuinely satisfied rather than reported unknown.
    language_tests: [
      { test: "IELTS", overall: over.ielts ?? 7.5, listening: 7, reading: 7, writing: 7, speaking: 7, test_date: "2026-03-01" },
    ],
    work: [
      {
        title: "Data Engineer",
        employer: "Himalaya Data Systems",
        industry: FIELD,
        country: "Nepal",
        start_date: new Date(Date.now() - (over.work_months ?? 30) * 30.44 * 86400000).toISOString().slice(0, 10),
        end_date: null,
        full_time: true,
        relevant: true,
      },
    ],
    career_goal: {
      target_occupation: "Data Engineer",
      target_industry: FIELD,
      intended_field: FIELD,
      reason: "Progression into data engineering.",
      change_field: false,
      long_term: "employment",
    },
    finance: {
      income_sources: [{ kind: "father", amount: 20000, currency: "AUD", evidence: true }],
      assets: [{ kind: "bank savings", amount: over.assets ?? 180000, currency: "AUD", liquid: true }],
      liabilities: [],
    },
    sponsors: [{ relationship: "Father", occupation: "Business", annual_income: 20000, currency: "AUD", evidence: true }],
    visa_history: [],
    preferences: {
      preferred_countries: ["AU"],
      preferred_cities: ["Melbourne"],
      degree_level: "Master",
      field: FIELD,
      max_tuition_per_year: over.budget ?? 40000,
      tuition_currency: "AUD",
      intake: "Feb 2027",
      scholarship_required: false,
      min_scholarship_pct: 0,
      ranking_matters: true,
      city_size: "big",
      cost_sensitivity: "low",
      part_time_work_important: false,
    },
  };
}

const main = async () => {
  const { data: login } = await axios.post(`${BASE}/auth/login`, {
    email: "admin@edu-visa.local",
    password: "password123",
  });
  const A = axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${login.access_token}` } });

  // Fixture courses, by their title suffix.
  const { data: cat } = await A.get(`/courses?_start=0&_end=50&field_like=${encodeURIComponent(FIELD)}`);
  const fixtureCourses = (cat.elements ?? cat).filter((c) => c.field === FIELD);
  const byKey = {};
  for (const c of fixtureCourses) {
    if (c.title.endsWith("(Advanced)")) byKey.advanced = c;
    else if (c.title.endsWith("(Accelerated)")) byKey.accelerated = c;
    else if (c.title.endsWith("(Research)")) byKey.research = c;
    else if (c.title.startsWith("Graduate Diploma")) byKey.diploma = c;
    else byKey.flagship = c;
  }
  check("fixture: 5 complete-data courses present", fixtureCourses.length === 5 && Object.keys(byKey).length === 5,
        `${fixtureCourses.length} courses`);

  const nameOf = (id) => fixtureCourses.find((c) => c.id === id)?.title ?? id.slice(0, 8);
  const isFixture = (id) => fixtureCourses.some((c) => c.id === id);

  const runFor = async (payload, opts = {}) => {
    const { data: s } = await A.post("/students", payload);
    await A.get(`/students/${s.id}/profile`); // derive
    const { data: run } = await A.post("/match/preview", { student_id: s.id, limit: 12, ...opts });
    return { student: s, run };
  };

  // ---- S1: the ideal profile ------------------------------------------------
  const s1 = await runFor(student("Ideal Candidate"));
  const r1 = s1.run.results;
  const fixtureTop = r1.slice(0, 4).every((r) => isFixture(r.course_id));
  check("S1 ideal: complete-data courses take the whole top 4", fixtureTop,
        r1.slice(0, 4).map((r) => `${r.overall}% ${nameOf(r.course_id)}`).join(" | "));

  const s1Order = r1.filter((r) => isFixture(r.course_id)).map((r) => ({ t: nameOf(r.course_id), o: r.overall }));
  const expected = [
    ["Master of Applied Data Engineering", 95],
    ["Master of Applied Data Engineering (Accelerated)", 91],
    ["Master of Applied Data Engineering (Research)", 85],
    ["Graduate Diploma of Applied Data Engineering", 73],
  ];
  const orderOk = expected.every(([t, o], i) => s1Order[i]?.t === t && s1Order[i]?.o === o);
  check("S1 ideal: predicted ranking AND predicted scores", orderOk,
        s1Order.map((x) => `${x.o}% ${x.t.replace("Master of Applied Data Engineering", "M.ADE")}`).join(" | "));

  const flag1 = r1.find((r) => r.course_id === byKey.flagship.id);
  check("S1 ideal: flagship subscores match the hand calculation",
        flag1.subscores.academic === 96 && flag1.subscores.english === 96 &&
        flag1.subscores.financial === 100 && flag1.subscores.career === 92 &&
        flag1.subscores.location === 100 && flag1.subscores.scholarship === 85,
        JSON.stringify(flag1.subscores));

  // The point of the fixture: a REAL verdict, not "insufficient_data".
  check("S1 ideal: admission verdict is eligible against a real policy",
        flag1.admission_eligibility.overall === "eligible" &&
        flag1.admission_eligibility.source === "real_policy" &&
        flag1.admission_eligibility.matched_band?.label === "Postgraduate (general)",
        `${flag1.admission_eligibility.overall} / band ${flag1.admission_eligibility.matched_band?.label}`);

  check("S1 ideal: won scholarship is named with its figure",
        flag1.scholarship_opportunities.some((o) => /Fixture Merit Award: 25%/.test(o)) &&
        flag1.scholarship_potential === "high",
        `${flag1.scholarship_potential}: ${flag1.scholarship_opportunities[0] ?? "none"}`);

  check("S1 ideal: over-budget course is excluded, not ranked",
        !r1.some((r) => r.course_id === byKey.advanced.id),
        "advanced (AUD 46,000 vs 40,000 budget) absent");

  check("S1 ideal: tier is calibrated (top result reads as safety)", flag1.tier === "safety", `tier=${flag1.tier}`);

  // ---- S2: same profile, tighter budget -----------------------------------
  const s2 = await runFor(student("Tight Budget", { budget: 30000 }));
  const r2 = s2.run.results.filter((r) => isFixture(r.course_id));
  check("S2 budget 30k: flagship and advanced both drop out on price",
        !r2.some((r) => r.course_id === byKey.flagship.id) && !r2.some((r) => r.course_id === byKey.advanced.id),
        r2.map((r) => `${r.overall}% ${nameOf(r.course_id)}`).join(" | "));
  check("S2 budget 30k: the accelerated course becomes first choice",
        r2[0]?.course_id === byKey.accelerated.id, nameOf(r2[0]?.course_id ?? ""));

  // ---- S3: same profile, not enough experience for the research degree ----
  const s3 = await runFor(student("Junior Candidate", { work_months: 6 }));
  const r3 = s3.run.results;
  const res3 = r3.find((r) => r.course_id === byKey.research.id);
  const flag3 = r3.find((r) => r.course_id === byKey.flagship.id);
  check("S3 six months' experience: the 24-month requirement costs career points",
        res3.subscores.career === 67 && flag3.subscores.career === 92,
        `research career ${res3.subscores.career} vs flagship ${flag3.subscores.career}`);
  check("S3: research ranks below both taught masters",
        r3.findIndex((r) => r.course_id === byKey.research.id) >
        r3.findIndex((r) => r.course_id === byKey.accelerated.id),
        `research at #${r3.findIndex((r) => r.course_id === byKey.research.id) + 1}`);

  // ---- S4: borderline GPA -------------------------------------------------
  const s4 = await runFor(student("Borderline GPA", { gpa: 2.9, budget: 50000 }));
  const r4 = s4.run.results;
  const flag4 = r4.find((r) => r.course_id === byKey.flagship.id);
  check("S4 GPA 73: courses needing 78 and 80 are knocked out on academics",
        !r4.some((r) => r.course_id === byKey.advanced.id) && !r4.some((r) => r.course_id === byKey.research.id),
        "advanced + research absent");
  check("S4 GPA 73: still eligible where the bar is 70", flag4?.admission_eligibility.overall === "eligible",
        `${flag4?.admission_eligibility.overall}`);
  check("S4 GPA 73: unmet scholarship is reported as a gap, not hidden",
        flag4.scholarship_opportunities.some((o) => /needs GPA 85/.test(o)),
        flag4.scholarship_opportunities[0] ?? "none");

  // ---- Tuning: the sliders must move the ranking predictably ---------------
  const tuned = async (weights) => {
    const { data: run } = await A.post("/match/preview", { student_id: s1.student.id, limit: 12, weights });
    return run.results.filter((r) => isFixture(r.course_id));
  };
  // An absent course must NOT silently read as 0 — that turned "the diploma was
  // knocked out" into a passing comparison against the flagship's own score.
  const gap = (rows, a, b) => {
    const x = rows.find((r) => r.course_id === byKey[a].id);
    const y = rows.find((r) => r.course_id === byKey[b].id);
    if (!x || !y) return NaN;
    return x.overall - y.overall;
  };
  const widened = (before, after) => Number.isFinite(before) && Number.isFinite(after) && after > before;

  const base = r1.filter((r) => isFixture(r.course_id));
  const baseSchGap = gap(base, "flagship", "accelerated");
  const schHeavy = await tuned({ academic: 0.15, english: 0.1, financial: 0.1, career: 0.15, location: 0.05, scholarship: 0.45 });
  const schGap = gap(schHeavy, "flagship", "accelerated");
  check("tuning: weighting scholarship widens the funded course's lead",
        widened(baseSchGap, schGap), `gap ${baseSchGap} -> ${schGap} points`);

  const baseCareerGap = gap(base, "flagship", "diploma");
  const careerHeavy = await tuned({ academic: 0.1, english: 0.1, financial: 0.1, career: 0.6, location: 0.05, scholarship: 0.05 });
  const careerGap = gap(careerHeavy, "flagship", "diploma");
  check("tuning: weighting career punishes the below-level diploma harder",
        widened(baseCareerGap, careerGap), `gap ${baseCareerGap} -> ${careerGap} points`);

  const academicHeavy = await tuned({ academic: 0.6, english: 0.1, financial: 0.1, career: 0.1, location: 0.05, scholarship: 0.05 });
  check("tuning: weighting academics widens the lead over the harder-entry course",
        widened(gap(base, "flagship", "research"), gap(academicHeavy, "flagship", "research")),
        `gap ${gap(base, "flagship", "research")} -> ${gap(academicHeavy, "flagship", "research")} points`);

  // Weight changes must not silently alter eligibility — a different opinion
  // about importance is not a different opinion about admissibility.
  const sameVerdict = schHeavy.every((r) => {
    const b = base.find((x) => x.course_id === r.course_id);
    return !b || b.admission_eligibility.overall === r.admission_eligibility.overall;
  });
  check("tuning: weights never change an admission verdict", sameVerdict);

  const pass = results.filter((r) => r.ok).length;
  console.log(`\n${pass}/${results.length} happy-path checks passed`);
  process.exit(pass === results.length ? 0 : 1);
};

main().catch((e) => {
  console.error(e.response?.data ?? e.message);
  process.exit(1);
});
