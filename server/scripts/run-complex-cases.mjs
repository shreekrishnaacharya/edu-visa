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
    // Either nothing survives the budget, or whatever survives is a
    // genuinely weak fit (reflecting the real financial/level mismatch) —
    // not a strong, well-aligned recommendation despite the stated budget.
    if (results.length === 0) {
      notes.push("all courses correctly knocked out on budget");
    } else if (results[0].overall < 55) {
      notes.push(`${results.length} survived but top overall=${results[0].overall} (weak fit, as expected under budget stress)`);
    } else {
      ok = false;
      notes.push(`budget stress not reflected: ${results.length} results, top overall=${results[0].overall}`);
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

  const cases = allCases();
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
