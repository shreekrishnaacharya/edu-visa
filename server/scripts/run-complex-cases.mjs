// Runs the 100 hand-designed complex scenarios (scripts/gen-complex-cases.mjs)
// against the REAL API + real CRICOS catalogue + real AI agent, checks each
// scenario's declared `expect` assertion against actual output, and produces
// a pass/fail report per archetype (not just "no exception").
import axios from "axios";
import { writeFileSync } from "fs";
import { allCases, BRANCH } from "./gen-complex-cases.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";

function checkExpect(expect, ctx) {
  const { run, profile, aiBody } = ctx;
  const results = run?.results ?? [];
  const notes = [];
  let ok = true;

  if (expect.match_results !== undefined && results.length !== expect.match_results) {
    ok = false; notes.push(`match_results: expected ${expect.match_results}, got ${results.length}`);
  }
  if (expect.match_results_gt !== undefined && !(results.length > expect.match_results_gt)) {
    ok = false; notes.push(`match_results_gt: expected >${expect.match_results_gt}, got ${results.length}`);
  }
  if (expect.missing_info_contains) {
    const hit = results.some((r) => r.missing_info.some((m) => m.toLowerCase().includes(expect.missing_info_contains.toLowerCase())));
    if (!hit) { ok = false; notes.push(`missing_info_contains "${expect.missing_info_contains}" not found in any result`); }
  }
  if (expect.concerns_contains) {
    const hit = results.some((r) => r.concerns.some((c) => c.toLowerCase().includes(expect.concerns_contains.toLowerCase())));
    if (!hit) { ok = false; notes.push(`concerns_contains "${expect.concerns_contains}" not found in any result`); }
  }
  if (expect.career_subscore_lt !== undefined) {
    const top = results[0];
    if (!top || !(top.subscores.career < expect.career_subscore_lt)) {
      ok = false; notes.push(`career_subscore_lt: expected <${expect.career_subscore_lt}, got ${top?.subscores.career}`);
    }
  }
  if (expect.survives_with_low_academic) {
    const top = results[0];
    if (!top) { ok = false; notes.push("expected at least one surviving (non-knocked-out) result"); }
    else notes.push(`academic subscore on survival: ${top.subscores.academic}`);
  }
  if (expect.scholarship_mentioned) {
    const inResults = results.some((r) => r.scholarship_opportunities.length > 0);
    const inAi = aiBody && /scholarship/i.test(aiBody);
    if (!inResults && !inAi) { ok = false; notes.push("no scholarship mention in engine results or AI answer"); }
  }
  if (expect.profile_created) {
    if (!profile || typeof profile.canonical_gpa !== "number") { ok = false; notes.push("profile not derived correctly"); }
    else notes.push(`canonical_gpa=${profile.canonical_gpa}`);
  }
  if (expect.affordability_lt_single_equivalent) {
    notes.push(`affordability_score=${profile?.affordability_score} (manual cross-check against a single-applicant equivalent — see report)`);
  }
  if (expect.graceful) {
    notes.push(`completed without throwing; results=${results.length}`);
  }
  if (expect.budget_stress) {
    // Rewritten after the catalogue grew from 8 research universities to the
    // whole CRICOS register (~663 providers). "Nothing is affordable" was true
    // of the old catalogue; it is now false — there are 48 real Master's courses
    // at or under AUD 20k/yr across 29 providers, which is exactly the
    // private-college segment budget-constrained students actually enrol in. So
    // a low top `overall` is no longer the right signal.
    //
    // What this case was really guarding is unchanged: the student must not be
    // handed something they cannot afford, and must be TOLD when a cheap option
    // is a poor fit. Assert those two things directly.
    if (results.length === 0) {
      notes.push("all courses knocked out on budget");
    } else {
      const overBudget = results.filter((r) => r.subscores.financial < 40);
      if (overBudget.length) {
        ok = false;
        notes.push(`${overBudget.length} result(s) scored below 40 on financial — unaffordable options surfaced`);
      }
      // Every surviving recommendation should either genuinely fit the stated
      // field/level, or carry an explicit concern saying it doesn't.
      const unflagged = results.filter(
        (r) => r.subscores.career < 60 && !r.concerns.some((c) => /weak link|justify the switch|entry bar|English requirement/i.test(c)),
      );
      if (unflagged.length) {
        ok = false;
        notes.push(`${unflagged.length} weak-fit result(s) carried no concern explaining the mismatch`);
      }
      notes.push(
        `${results.length} affordable option(s); top overall=${results[0].overall}, career=${results[0].subscores.career} (cheap providers now genuinely exist)`,
      );
    }
  }
  return { ok, notes };
}

async function freshClient() {
  const { data: login } = await axios.post(`${BASE}/auth/login`, { email: "admin@edu-visa.local", password: "password123" });
  return axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${login.access_token}` } });
}

async function main() {
  let A = await freshClient();
  // JWT_ACCESS_TTL defaults to 900s; a 100-case × AI-question batch can run
  // well past that. Re-authenticate proactively rather than 401ing mid-batch.
  let lastLogin = Date.now();
  const RELOGIN_EVERY_MS = 8 * 60 * 1000;

  // ARCHETYPE=<name> runs just one archetype — re-verifying a single assertion
  // shouldn't require another 100 real AI calls.
  const only = process.env.ARCHETYPE;
  const cases = allCases().filter((c) => !only || c.archetype === only);
  const report = { started_at: new Date().toISOString(), branch: BRANCH, n: cases.length, records: [] };
  let passed = 0, failed = 0, errored = 0;
  const byArchetype = {};

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const rec = { idx: i + 1, archetype: c.archetype, variant: c.variant, name: c.student.full_name };
    byArchetype[c.archetype] ??= { total: 0, passed: 0 };
    byArchetype[c.archetype].total++;
    if (Date.now() - lastLogin > RELOGIN_EVERY_MS) {
      A = await freshClient();
      lastLogin = Date.now();
    }
    try {
      const { data: student } = await A.post("/students", c.student);
      rec.student_id = student.id;
      const { data: profile } = await A.get(`/students/${student.id}/profile`);
      const { data: run } = await A.post("/match/runs", { student_id: student.id });
      rec.match_results = run.results.length;
      rec.top_overall = run.results[0]?.overall ?? null;

      let aiBody = null;
      if (c.ai_question) {
        try {
          const { data: msg } = await A.post("/assistant/messages", { student_id: student.id, body: c.ai_question }, { timeout: 60000 });
          aiBody = msg.reply.body;
          rec.ai = { ok: true, degraded: !!msg.reply.meta?.degraded, cites: (msg.reply.meta?.cites || []).length, preview: aiBody.slice(0, 200) };
        } catch (e) {
          rec.ai = { ok: false, error: e?.response?.data?.message || e.message };
        }
      }

      const verdict = checkExpect(c.expect, { run, profile, aiBody });
      rec.expect = c.expect;
      rec.verdict = verdict.ok ? "PASS" : "FAIL";
      rec.notes = verdict.notes;
      if (verdict.ok) { passed++; byArchetype[c.archetype].passed++; } else failed++;
    } catch (e) {
      errored++;
      rec.verdict = "ERROR";
      rec.error = e?.response?.data?.message || e.message;
    }
    report.records.push(rec);
    if ((i + 1) % 10 === 0) console.log(`... ${i + 1}/${cases.length} (pass=${passed} fail=${failed} error=${errored})`);
  }

  report.summary = { passed, failed, errored, total: cases.length, by_archetype: byArchetype };
  try {
    const { data: bal } = await axios.get("https://openrouter.ai/api/v1/auth/key", { headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` } });
    report.summary.openrouter_remaining_usd = bal.data.limit_remaining;
  } catch { /* best effort */ }

  writeFileSync("/tmp/complex-cases-report.json", JSON.stringify(report, null, 2));
  console.log("\n=== COMPLEX CASES SUMMARY ===");
  console.log(JSON.stringify(report.summary, null, 2));
  const failures = report.records.filter((r) => r.verdict !== "PASS");
  if (failures.length) {
    console.log(`\n${failures.length} non-pass record(s):`);
    failures.forEach((f) => console.log(`  #${f.idx} [${f.archetype}] ${f.verdict}: ${(f.notes || []).join("; ") || f.error}`));
  }
}

main().catch((e) => {
  console.error("FATAL:", e?.response?.data ?? e);
  process.exit(1);
});
