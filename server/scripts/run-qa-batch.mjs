// Overnight QA batch: creates 100 synthetic students through the real API,
// derives profiles, runs the matching engine on every one, and exercises the
// AI assistant (real OpenRouter + RAG) on a diverse subset. Produces a full
// JSON report plus a printed summary.
import axios from "axios";
import { writeFileSync } from "fs";
import { buildStudent } from "./gen-test-students.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const N = parseInt(process.env.QA_N || "100", 10);
const AI_SAMPLE_EVERY = parseInt(process.env.QA_AI_EVERY || "3", 10); // ~33 of 100 get AI questions

function questionsFor(qa) {
  const qs = [];
  if (qa.hasRefusal) qs.push("Given my visa refusal history, what are my chances and what should I prepare?");
  if (!qa.hasTest) qs.push("I don't have an English test result yet. What are my options and what score do I need?");
  qs.push("Why was my top-ranked course recommended, and what should I watch out for?");
  return qs.slice(0, 2);
}

async function freshClient() {
  const { data: login } = await axios.post(`${BASE}/auth/login`, { email: "admin@edu-visa.local", password: "password123" });
  return axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${login.access_token}` } });
}

async function main() {
  const t0 = Date.now();
  let A = await freshClient();
  let lastLogin = Date.now();
  const RELOGIN_EVERY_MS = 8 * 60 * 1000; // JWT_ACCESS_TTL defaults to 900s

  const students = Array.from({ length: N }, (_, i) => buildStudent(i + 1));
  const report = { started_at: new Date().toISOString(), base_url: BASE, n: N, ai_sample_every: AI_SAMPLE_EVERY, records: [], errors: [] };

  let created = 0, matched = 0, noRealMatch = 0, aiAsked = 0, aiOk = 0, aiDegraded = 0, aiFailed = 0;

  for (let i = 0; i < students.length; i++) {
    const payload = students[i];
    const qa = payload._qa;
    delete payload._qa;
    const rec = { idx: i + 1, name: payload.full_name, gpa_scale: qa.gpaScale, has_refusal: qa.hasRefusal, has_test: qa.hasTest };
    const tRec0 = Date.now();
    if (Date.now() - lastLogin > RELOGIN_EVERY_MS) {
      A = await freshClient();
      lastLogin = Date.now();
    }
    try {
      const { data: createdStudent } = await A.post("/students", payload);
      created++;
      rec.student_id = createdStudent.id;
      const { data: profile } = await A.get(`/students/${createdStudent.id}/profile`);
      rec.profile = { gpa: profile.canonical_gpa, english: profile.english_band, affordability: profile.affordability_score, version: profile.version };

      const { data: run } = await A.post("/match/runs", { student_id: createdStudent.id });
      matched++;
      const realMatches = run.results.filter((r) => !r.knockout).length;
      rec.match = { run_id: run.id, results: run.results.length, real_matches: realMatches, top_overall: run.results[0]?.overall ?? null, top_is_closest_miss: !!run.results[0]?.knockout };
      if (realMatches === 0) noRealMatch++;

      if (i % AI_SAMPLE_EVERY === 0) {
        rec.ai = [];
        for (const q of questionsFor(qa)) {
          aiAsked++;
          const tAi0 = Date.now();
          try {
            const { data: msg } = await A.post("/assistant/messages", { student_id: createdStudent.id, body: q }, { timeout: 60000 });
            const meta = msg.reply.meta || {};
            rec.ai.push({ q, ok: true, ms: Date.now() - tAi0, degraded: !!meta.degraded, cites: (meta.cites || []).length, confidence: meta.confidence, answer_preview: msg.reply.body.slice(0, 220) });
            if (meta.degraded) aiDegraded++; else aiOk++;
          } catch (e) {
            aiFailed++;
            rec.ai.push({ q, ok: false, ms: Date.now() - tAi0, error: e?.response?.data?.message || e.message });
          }
        }
      }
    } catch (e) {
      report.errors.push({ idx: i + 1, name: payload.full_name, error: e?.response?.data?.message || e.message, detail: e?.response?.data });
      rec.error = e?.response?.data?.message || e.message;
    }
    rec.total_ms = Date.now() - tRec0;
    report.records.push(rec);
    if ((i + 1) % 10 === 0) console.log(`... ${i + 1}/${N} done (created=${created} matched=${matched} ai_asked=${aiAsked})`);
  }

  report.summary = {
    duration_ms: Date.now() - t0,
    created, matched, noRealMatch, // students with zero real (non-fallback) matches
    aiAsked, aiOk, aiDegraded, aiFailed,
    errorCount: report.errors.length,
  };

  try {
    const { data: bal } = await axios.get("https://openrouter.ai/api/v1/auth/key", { headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` } });
    report.summary.openrouter_remaining_usd = bal.data.limit_remaining;
  } catch { /* best effort */ }

  writeFileSync("/tmp/qa-batch-report.json", JSON.stringify(report, null, 2));
  console.log("\n=== QA BATCH SUMMARY ===");
  console.log(JSON.stringify(report.summary, null, 2));
  if (report.errors.length) {
    console.log(`\n${report.errors.length} record(s) failed:`);
    report.errors.slice(0, 10).forEach((e) => console.log(`  #${e.idx} ${e.name}: ${e.error}`));
  }
}

main().catch((e) => {
  console.error("FATAL:", e?.response?.data ?? e);
  process.exit(1);
});
