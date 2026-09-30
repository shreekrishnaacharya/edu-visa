// ---------------------------------------------------------------------------
// REAL-WORLD MATCH TEST — real catalogue, real admission briefings.
//
// The companion to scripts/happy-path-test.mjs. That one seeds a synthetic
// institution where every field is populated; this one touches NO fixture data.
// Every course is a real CRICOS register row and every expectation is derived
// from what one of the 9 real agent briefings actually says, so a failure means
// the system misreads a real document.
//
// The cases are all "same institution, one thing different", because that is
// where a mistake is invisible in aggregate but wrong in front of a client:
//   CQU        one level, two academic bars (60% vs 70%) — its own document
//              names Master of Project Management under the Engineering band
//   Sydney Met one level, two English bars (6.5 vs 7.0 per skill)
//   Newcastle  one institution, two levels (PG 55% vs UG 70%)
//   no policy  655 providers have no briefing at all — must say "unknown",
//              never "pass"
//
// Students are created through the real API, tagged branch=REAL_CASE_TEST, and
// deleted at the end (including their profile rows, which do not cascade).
//
// Run: node scripts/real-case-test.mjs
// ---------------------------------------------------------------------------
import axios from "axios";
import pg from "pg";

const BASE = process.env.API || "http://localhost:3000";
const MARK = "REAL_CASE_TEST";
const db = new pg.Client({ host: "localhost", user: "eduvisa", password: "eduvisa", database: "eduvisa" });

const results = [];
const gaps = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? `  — ${detail}` : ""}`);
};
/** A defect this suite documents rather than asserts away. Reported, not failed. */
const knownGap = (name, detail) => {
  gaps.push({ name, detail });
  console.log(`⚠ KNOWN GAP: ${name}  — ${detail}`);
};

/**
 * A realistic Nepali applicant. Finances clear CQU's stated 22-lakh household
 * income floor on purpose — otherwise the income check fails and every verdict
 * comes back not_eligible for a reason unrelated to the bar under test.
 */
function student(name, over = {}) {
  return {
    full_name: `${name} (REAL CASE)`,
    date_of_birth: "1999-06-15",
    gender: over.gender ?? "male",
    nationality: "Nepal",
    current_city: "Kathmandu",
    passport_status: "held",
    marital_status: "single",
    dependants: [],
    state: "Shortlisted",
    counsellor: "Real Case QA",
    branch: MARK,
    consent_given_at: new Date().toISOString(),
    academic: [
      {
        level: "Bachelor",
        course: over.bachelor ?? "Bachelor of Business Administration",
        institution: "Tribhuvan University",
        country: "Nepal",
        start_year: 2017,
        end_year: 2021,
        gpa_value: over.gpa,
        gpa_scale: "4.0",
        gap_months: 0,
        backlogs: 0,
      },
    ],
    language_tests: [
      {
        test: "IELTS",
        overall: over.ielts,
        listening: over.band, reading: over.band, writing: over.band, speaking: over.band,
        test_date: "2026-04-01",
      },
    ],
    work: [],
    career_goal: {
      target_occupation: over.occupation ?? "Operations Manager",
      target_industry: over.field ?? "Management",
      intended_field: over.field ?? "Management",
      reason: "Career progression.",
      change_field: false,
      long_term: "employment",
    },
    finance: {
      // 28 lakh NPR clears CQU's 22-lakh single-applicant floor.
      income_sources: [{ kind: "father", amount: 2800000, currency: "NPR", evidence: true }],
      assets: [{ kind: "bank savings", amount: 9000000, currency: "NPR", liquid: true }],
      liabilities: [],
    },
    sponsors: [{ relationship: "Father", occupation: "Business", annual_income: 2800000, currency: "NPR", evidence: true }],
    visa_history: [],
    preferences: {
      preferred_countries: ["AU"],
      preferred_cities: over.cities ?? ["Melbourne"],
      degree_level: over.level ?? "Master",
      field: over.field ?? "Management",
      max_tuition_per_year: over.budget ?? 50000,
      tuition_currency: "AUD",
      intake: "Feb 2027",
      scholarship_required: false,
      min_scholarship_pct: 0,
      ranking_matters: false,
      city_size: "either",
      cost_sensitivity: "low",
      part_time_work_important: false,
    },
  };
}

const main = async () => {
  await db.connect();
  const { data: login } = await axios.post(`${BASE}/auth/login`, {
    email: "admin@edu-visa.local", password: "password123",
  });
  const A = axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${login.access_token}` } });

  const courseId = async (policyKey, title, level) => {
    const r = await db.query(
      `SELECT c.id, c.title, c.tuition_fee FROM course c JOIN university u ON u.id = c.university_id
        WHERE u.policy_key = $1 AND c.title = $2 AND c.degree_level = $3 ORDER BY c.tuition_fee LIMIT 1`,
      [policyKey, title, level]);
    if (!r.rows.length) throw new Error(`real course not found: ${policyKey} / ${title} / ${level}`);
    return r.rows[0];
  };

  const created = [];
  const runFor = async (payload, opts = {}) => {
    const { data: s } = await A.post("/students", payload);
    created.push(s.id);
    await A.get(`/students/${s.id}/profile`);
    // Gate OFF so a not_eligible course still comes back with its verdict
    // attached — with the gate on it is knocked out and cannot be inspected.
    const { data: run } = await A.post("/match/preview", {
      student_id: s.id, limit: 20000, enforce_admission_eligibility: false, ...opts,
    });
    return { id: s.id, results: run.results };
  };
  const find = (rows, id) => rows.find((r) => r.course_id === id);
  const acad = (r) => r.admission_eligibility.checks.find((c) => c.rule === "academic score");
  const eng = (r) => r.admission_eligibility.checks.find((c) => /^English score/.test(c.rule));

  // ======== CASE 1: CQU — one institution, one level, two academic bars =====
  const mba = await courseId("cqu", "Master of Business Administration", "Master");
  const mpm = await courseId("cqu", "Master of Project Management", "Master");
  const mcm = await courseId("cqu", "Master of Construction Management", "Master");

  // GPA 2.6/4.0 -> canonical 65: above CQU's Management bar (60), below its
  // Engineering bar (70). One number, two correct-but-opposite answers.
  const rc1 = await runFor(student("CQU Split", { gpa: 2.6, ielts: 6.5, band: 6.0, budget: 45000 }));
  const rMba = find(rc1.results, mba.id), rMpm = find(rc1.results, mpm.id), rMcm = find(rc1.results, mcm.id);

  check("CQU: all three real courses are scored and carry a real-policy verdict",
        [rMba, rMpm, rMcm].every((r) => r?.admission_eligibility.source === "real_policy"),
        [rMba, rMpm, rMcm].map((r) => r?.admission_eligibility.source).join(", "));

  check("CQU: the MBA is judged against the Management band (60%)",
        rMba.admission_eligibility.matched_band?.label === "Management programs" &&
        rMba.admission_eligibility.matched_band?.min_canonical_score === 60,
        `${rMba.admission_eligibility.matched_band?.label} @ ${rMba.admission_eligibility.matched_band?.min_canonical_score}`);

  check("CQU: Project Management is judged against the Engineering band (70%), as its document states",
        /^Engineering programs/.test(rMpm.admission_eligibility.matched_band?.label ?? "") &&
        rMpm.admission_eligibility.matched_band?.min_canonical_score === 70,
        `${rMpm.admission_eligibility.matched_band?.label} @ ${rMpm.admission_eligibility.matched_band?.min_canonical_score}`);

  check("CQU: Construction Management likewise takes the Engineering band",
        rMcm.admission_eligibility.matched_band?.min_canonical_score === 70,
        `${rMcm.admission_eligibility.matched_band?.label}`);

  check("CQU: GPA 65 passes the 60% bar and fails the 70% bar — same student, same level",
        acad(rMba)?.status === "pass" && acad(rMpm)?.status === "fail" && acad(rMcm)?.status === "fail",
        `MBA ${acad(rMba)?.status} / MPM ${acad(rMpm)?.status} / MCM ${acad(rMcm)?.status}`);

  check("CQU: the verdict quotes the document's own wording, not a derived number",
        acad(rMpm)?.detail.includes("70%") && rMpm.admission_eligibility.matched_band?.source_expression === "70%",
        acad(rMpm)?.detail ?? "");

  check("CQU: failing the academic bar makes the course not_eligible",
        rMpm.admission_eligibility.overall === "not_eligible" && rMcm.admission_eligibility.overall === "not_eligible",
        `${rMpm.admission_eligibility.overall}`);

  // The gate is what a counsellor actually sees by default.
  const rc1Gated = await A.post("/match/preview", { student_id: rc1.id, limit: 20000 })
    .then((r) => r.data.results);
  check("CQU: with the eligibility gate on, the two 70%-bar courses are withheld",
        !find(rc1Gated, mpm.id) && !find(rc1Gated, mcm.id),
        `MBA still listed: ${!!find(rc1Gated, mba.id)}`);

  // CQU's briefing carries GS and Indian-state-board notes.
  check("CQU: advisory notes are surfaced without changing the verdict",
        rMba.admission_eligibility.advisory_notes.length > 0 &&
        rMba.admission_eligibility.advisory_notes.some((n) => /Genuine Student/.test(n.label)),
        rMba.admission_eligibility.advisory_notes.map((n) => n.label).join(", "));

  // ======== CASE 2: Sydney Met — one level, two English bars ===============
  const mit = await courseId("sydney-met", "Master of Information Technology", "Master");
  const msw = await courseId("sydney-met", "Master of Social Work (Qualifying)", "Master");
  // IELTS 6.5 with every skill at 6.5: clears MIT (6.5 overall / 6.0 a skill),
  // misses MSW (7.0 overall / 7.0 a skill). GPA 2.8 -> 70 clears both bars.
  const rc2 = await runFor(student("SydMet English", {
    gpa: 2.8, ielts: 6.5, band: 6.5, budget: 50000, field: "Information Technology", occupation: "Systems Analyst",
  }));
  const rMit = find(rc2.results, mit.id), rMsw = find(rc2.results, msw.id);

  check("Sydney Met: each course resolves to its own named band",
        rMit.admission_eligibility.matched_band?.label === "Master of Information Technology" &&
        rMsw.admission_eligibility.matched_band?.label === "Master of Social Work (Qualifying)",
        `${rMit.admission_eligibility.matched_band?.label} | ${rMsw.admission_eligibility.matched_band?.label}`);

  check("Sydney Met: IELTS 6.5 clears the 6.5 course and fails the 7.0 course",
        eng(rMit)?.status === "pass" && eng(rMsw)?.status === "fail",
        `MIT ${eng(rMit)?.status} / MSW ${eng(rMsw)?.status}`);

  check("Sydney Met: the academic bar passes for both, so only English separates them",
        acad(rMit)?.status === "pass" && acad(rMsw)?.status === "pass",
        `MIT ${acad(rMit)?.status} / MSW ${acad(rMsw)?.status}`);

  // ======== CASE 3: Newcastle — one institution, two levels ================
  const nPg = await courseId("newcastle", "Master of Philosophy (Economics)", "Master");
  const nUg = await courseId("newcastle", "Bachelor of Arts (Honours)", "Bachelor");
  // GPA 2.4/4.0 -> 60: above Newcastle's PG bar (55%), below its UG bar (70%).
  const rc3 = await runFor(student("Newcastle Levels", { gpa: 2.4, ielts: 7.0, band: 6.5, budget: 45000 }));
  const rNpg = find(rc3.results, nPg.id), rNug = find(rc3.results, nUg.id);

  check("Newcastle: the postgraduate course takes the PG band (55%)",
        rNpg.admission_eligibility.matched_band?.min_canonical_score === 55 &&
        rNpg.admission_eligibility.matched_band?.level === "PG",
        `${rNpg.admission_eligibility.matched_band?.label} @ ${rNpg.admission_eligibility.matched_band?.min_canonical_score}`);

  check("Newcastle: the bachelor course takes the UG band (70%)",
        rNug.admission_eligibility.matched_band?.min_canonical_score === 70 &&
        rNug.admission_eligibility.matched_band?.level === "UG",
        `${rNug.admission_eligibility.matched_band?.label} @ ${rNug.admission_eligibility.matched_band?.min_canonical_score}`);

  check("Newcastle: GPA 60 is eligible postgraduate and not eligible undergraduate",
        acad(rNpg)?.status === "pass" && acad(rNug)?.status === "fail",
        `PG ${acad(rNpg)?.status} / UG ${acad(rNug)?.status}`);

  // ======== CASE 4: the 655 providers with no briefing ====================
  const noPolicy = await db.query(
    `SELECT c.id, c.title, u.name FROM course c JOIN university u ON u.id = c.university_id
      WHERE u.policy_key IS NULL AND c.degree_level = 'Master'
        AND c.tuition_fee BETWEEN 25000 AND 40000 AND (c.entry->>'min_gpa') IS NULL LIMIT 1`);
  const rNo = find(rc2.results, noPolicy.rows[0].id) ?? find(rc1.results, noPolicy.rows[0].id);
  check("No briefing on file: reported as unsourced, never as a pass",
        rNo?.admission_eligibility.source === "catalogue_entry_requirement" &&
        rNo?.admission_eligibility.overall === "insufficient_data" &&
        acad(rNo)?.status === "unknown" && /not been sourced/.test(acad(rNo)?.detail ?? ""),
        `${noPolicy.rows[0].name}: ${rNo?.admission_eligibility.overall}`);

  // ======== CASE 5: hard constraints hold across many real students ========
  const real = await db.query(
    `SELECT s.id, p.max_tuition_per_year FROM student s JOIN preferences p ON p.student_id = s.id
      WHERE s.branch <> $1 ORDER BY s.created_at LIMIT 25`, [MARK]);
  let violations = [];
  const today = new Date().toISOString().slice(0, 10);
  for (const row of real.rows) {
    const { data: run } = await A.post("/match/preview", { student_id: row.id, limit: 8 });
    for (const r of run.results) {
      if (r.knockout) continue;
      const c = await db.query(`SELECT title, tuition_fee, application_deadline FROM course WHERE id=$1`, [r.course_id]);
      const cc = c.rows[0];
      if (Number(cc.tuition_fee) > Number(row.max_tuition_per_year) * 1.05)
        violations.push(`over budget: ${cc.title} ${cc.tuition_fee} > ${row.max_tuition_per_year}`);
      if (cc.application_deadline.toISOString?.().slice(0, 10) < today)
        violations.push(`past deadline: ${cc.title}`);
      if (!(r.overall > 0) || r.tier === null) violations.push(`unranked row: ${cc.title}`);
    }
  }
  check("25 real students: no recommendation breaks a hard constraint",
        violations.length === 0, violations.slice(0, 3).join(" | ") || "budget, deadline and tier all hold");

  // ======== CASE 6: the two eligibility surfaces must agree ===============
  const cqMba = await db.query(`SELECT field FROM course WHERE id = $1`, [mba.id]);
  const { data: direct } = await A.post("/admission/check-eligibility", {
    student_id: rc1.id, policy_key: "cqu", level: "PG",
    course_label: "Master of Business Administration",
    course_field: cqMba.rows[0].field,
  });
  check("both eligibility surfaces resolve the same band for the same course",
        direct.matched_band?.label === rMba.admission_eligibility.matched_band?.label &&
        direct.overall === rMba.admission_eligibility.overall,
        `standalone "${direct.matched_band?.label ?? "no band"}" / report "${rMba.admission_eligibility.matched_band?.label}"`);

  // Without the field the endpoint cannot see CQU's Management band at all —
  // kept as a check so the reason this parameter exists stays documented.
  const { data: noField } = await A.post("/admission/check-eligibility", {
    student_id: rc1.id, policy_key: "cqu", level: "PG",
    course_label: "Master of Business Administration",
  });
  check("omitting the field is what used to lose the band (documents the fix)",
        noField.matched_band == null,
        `without course_field: ${noField.matched_band?.label ?? "no band"} -> ${noField.overall}`);

  // ======== CASE 7: a real counsellor request the catalogue cannot serve ===
  const ds = await runFor(student("Data Science Seeker", {
    gpa: 3.2, ielts: 7.0, band: 6.5, budget: 50000, field: "Data Science", occupation: "Data Scientist",
  }));
  const top8 = ds.results.slice(0, 8);
  const titles = [];
  for (const r of top8) {
    const c = await db.query(`SELECT title FROM course WHERE id=$1`, [r.course_id]);
    titles.push(c.rows[0].title);
  }
  const relevant = titles.filter((t) => /data scien|analytics|machine learning/i.test(t)).length;
  if (relevant === 0) {
    const avail = await db.query(`SELECT count(*)::int n FROM course WHERE title ILIKE '%data scien%'`);
    knownGap("a 'Data Science' request returns nothing about data science",
      `0 of the top 8 titles are data-science related, though ${avail.rows[0].n} such courses exist — ` +
      `careerScore compares the goal against course.field only, and no CRICOS field label contains "Data Science"`);
  } else {
    check("Data Science request returns data-science courses", true, `${relevant}/8`);
  }

  // ---- cleanup: students AND their profile rows (no FK, so no cascade) ----
  if (created.length) {
    await db.query(`DELETE FROM student_profile WHERE student_id = ANY($1::text[])`, [created]);
    await db.query(`DELETE FROM student WHERE id = ANY($1::uuid[])`, [created]);
  }
  const left = await db.query(`SELECT count(*)::int n FROM student WHERE branch = $1`, [MARK]);
  check("cleanup: every student this run created is gone", left.rows[0].n === 0, `${created.length} removed`);

  await db.end();
  const pass = results.filter((r) => r.ok).length;
  console.log(`\n${pass}/${results.length} real-world checks passed`);
  if (gaps.length) console.log(`${gaps.length} known gap(s) documented above — defects in the product, not test failures`);
  process.exit(pass === results.length ? 0 : 1);
};

main().catch(async (e) => {
  console.error(e.response?.data ?? e.message);
  try { await db.end(); } catch {}
  process.exit(1);
});
