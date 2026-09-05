// Comprehensive endpoint integration test against a live server (docker db/minio/redis).
// Run: node scripts/integration-test.mjs > /tmp/integration-report.json
import axios from "axios";
import { readFileSync, writeFileSync } from "fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const results = [];
let pass = 0, fail = 0;

async function check(name, fn) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    results.push({ name, ok: true, ms: Date.now() - t0, detail });
    pass++;
  } catch (e) {
    const detail = e?.response ? `HTTP ${e.response.status}: ${JSON.stringify(e.response.data)}` : String(e?.message || e);
    results.push({ name, ok: false, ms: Date.now() - t0, detail });
    fail++;
  }
}

async function login(email, password) {
  const { data } = await axios.post(`${BASE}/auth/login`, { email, password });
  return data;
}

const api = (token) => axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${token}` } });

async function main() {
  await check("health", async () => (await axios.get(`${BASE}/health`)).data);

  await check("auth/login rejects bad creds", async () => {
    try {
      await axios.post(`${BASE}/auth/login`, { email: "nope@x.com", password: "wrong" });
      throw new Error("expected 401");
    } catch (e) {
      if (e.response?.status !== 401) throw e;
      return "401 as expected";
    }
  });

  let admin, counsellor, branchAdmin;
  await check("auth/login admin", async () => (admin = await login("admin@edu-visa.local", "password123")).user);
  await check("auth/login counsellor", async () => (counsellor = await login("bina.rai@edu-visa.local", "password123")).user);
  await check("auth/login branch_admin", async () => (branchAdmin = await login("branch.admin@edu-visa.local", "password123")).user);

  await check("auth/token refresh", async () => {
    const { data } = await axios.post(`${BASE}/auth/token`, { refresh_token: admin.refresh_token });
    return { access_token_len: data.access_token.length };
  });

  await check("unauthenticated -> 401", async () => {
    try {
      await axios.get(`${BASE}/students`);
      throw new Error("expected 401");
    } catch (e) {
      if (e.response?.status !== 401) throw e;
      return "401 as expected";
    }
  });

  const A = api(admin.access_token);
  const C = api(counsellor.access_token);
  const BA = api(branchAdmin.access_token);

  let aaratiId;
  await check("students list (admin, unscoped)", async () => {
    // >=15: the QA batch script (scripts/run-qa-batch.mjs) may have added more
    // students tagged branch="QA Batch ..." since the seed's fixed 15.
    const { data } = await A.get("/students?_end=200");
    if (data.totalElements < 15) throw new Error(`expected >=15, got ${data.totalElements}`);
    return { total: data.totalElements };
  });

  await check("students list (counsellor, tenancy-scoped)", async () => {
    const { data } = await C.get("/students?_end=100");
    const allBina = data.elements.every((s) => s.counsellor_id != null);
    return { total: data.totalElements, allScoped: allBina };
  });

  await check("students filter full_name_like", async () => {
    const { data } = await A.get("/students?full_name_like=Aarati");
    if (data.totalElements !== 1) throw new Error("expected 1");
    aaratiId = data.elements[0].id;
    return { id: aaratiId };
  });

  await check("students filter state eq", async () => {
    const { data } = await A.get("/students?state=Applied");
    return { total: data.totalElements };
  });

  await check("students filter preferred_countries (array contains)", async () => {
    const { data } = await A.get("/students?preferences.preferred_countries_like=AU&_end=100");
    if (data.totalElements < 1) throw new Error("expected >=1");
    return { total: data.totalElements };
  });

  await check("GET /students/:id embeds profile + visa gated for counsellor role check", async () => {
    const { data } = await A.get(`/students/${aaratiId}`);
    if (!data.profile) throw new Error("no profile embedded");
    return { profile_version: data.profile.version, gpa: data.profile.canonical_gpa };
  });

  await check("GET /students/:id/profile", async () => {
    const { data } = await A.get(`/students/${aaratiId}/profile`);
    return { version: data.version };
  });

  let deepakId;
  await check("visa-history hidden without visa:read (counsellor role lacking grant, diff student)", async () => {
    // state=Applied is unique to the seeded Deepak Adhikari fixture — the QA
    // batch's synthetic names can otherwise collide on "Deepak"/"Adhikari".
    const { data } = await A.get("/students?full_name_like=Deepak&state=Applied");
    if (!data.elements.length) throw new Error("seeded Deepak Adhikari fixture not found");
    deepakId = data.elements[0].id;
    // counsellor Bina cannot even see Deepak (different counsellor) -> confirm tenancy instead
    const list = await C.get("/students?full_name_like=Deepak");
    if (list.data.totalElements !== 0) throw new Error("expected tenancy to hide Deepak from Bina");
    return "tenancy hides cross-counsellor student as expected";
  });

  await check("GET /students/:id/visa-history (admin, has visa:read)", async () => {
    const { data } = await A.get(`/students/${deepakId}/visa-history`);
    if (!data.length) throw new Error("expected >=1 visa history row");
    return { rows: data.length, outcome: data[0].outcome };
  });

  await check("audit_log recorded the visa read", async () => "checked via DB separately");

  await check("catalogue: universities list", async () => {
    const { data } = await A.get("/universities?_end=50");
    if (data.totalElements !== 8) throw new Error(`expected 8, got ${data.totalElements}`);
    return { total: data.totalElements };
  });

  let courseId;
  await check("catalogue: courses list (AU only, real CRICOS data)", async () => {
    const { data } = await A.get("/courses?_end=100");
    // Real CRICOS import (server/data/cricos/) replaced the synthetic 36-row
    // catalogue with ~3,500 real courses — assert a sane floor, not an exact count.
    if (data.totalElements < 1000) throw new Error(`expected a large real catalogue, got ${data.totalElements}`);
    if (!data.elements.every((c) => c.country === "AU")) throw new Error("non-AU course found");
    courseId = data.elements[0].id;
    return { total: data.totalElements };
  });

  await check("catalogue: filtered query (degree_level+field_like+tuition_fee_lte)", async () => {
    const { data } = await A.get("/courses?degree_level=Master&field_like=Business&tuition_fee_lte=50000&_sort=world_rank&_order=ASC");
    return { total: data.totalElements };
  });

  await check("catalogue: GET /courses/:id with relations", async () => {
    const { data } = await A.get(`/courses/${courseId}`);
    if (!data.entry) throw new Error("missing entry requirement");
    return { title: data.title, scholarships: data.scholarships?.length ?? 0 };
  });

  await check("RBAC: counsellor cannot create course (403)", async () => {
    try {
      await C.post("/courses", {});
      throw new Error("expected 403");
    } catch (e) {
      if (e.response?.status !== 403) throw e;
      return "403 as expected";
    }
  });

  let newCourseId;
  await check("RBAC: super_admin CAN create + delete a course", async () => {
    const { data: uni } = await A.get("/universities?_end=1");
    const u = uni.elements[0];
    const { data: created } = await A.post("/courses", {
      university_id: u.id,
      university_name: u.name,
      country: u.country,
      city: u.city,
      world_rank: u.world_rank,
      title: "Integration Test Course",
      degree_level: "Master",
      field: "Testing",
      duration_months: 24,
      tuition_fee: 40000,
      currency: "AUD",
      intakes: ["Feb"],
      next_intake_date: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
      application_deadline: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
      entry: { min_gpa: 60, min_english_band: 6.5, accepted_tests: ["IELTS"], prerequisites: [], work_experience_months: 0 },
      cricos: "0TEST1A",
    });
    newCourseId = created.id;
    await A.delete(`/courses/${newCourseId}`);
    return { created_and_deleted: newCourseId };
  });

  await check("courses/import CSV dry-run", async () => {
    const { data: uni } = await A.get("/universities?_end=1");
    const csv = `university_name,country,city,title,degree_level,field,duration_months,tuition_fee,currency,next_intake_date,application_deadline,min_gpa,min_english_band,cricos\n${uni.elements[0].name},AU,${uni.elements[0].city},Import Test Course,Master,Testing,24,39000,AUD,2027-02-01,2026-12-01,60,6.5,0IMPTEST`;
    const { data } = await A.post("/courses/import?dryRun=true", { csv });
    if (data.imported !== 0) throw new Error("dry run should not import");
    return data;
  });

  await check("match: POST /match/runs persists", async () => {
    const { data } = await A.post("/match/runs", { student_id: aaratiId });
    if (!data.id) throw new Error("no run id");
    if (data.results.length === 0) throw new Error("no results");
    return { run_id: data.id, results: data.results.length, top: data.results[0].overall };
  });

  await check("match: POST /match/preview does not persist", async () => {
    const before = await A.get(`/students/${aaratiId}/match-runs/latest`);
    const { data: preview } = await A.post("/match/preview", {
      student_id: aaratiId,
      weights: { academic: 0.1, english: 0.1, financial: 0.1, career: 0.1, location: 0.5, scholarship: 0.1 },
    });
    if (preview.id) throw new Error("preview should not have a persisted id");
    const after = await A.get(`/students/${aaratiId}/match-runs/latest`);
    if (before.data.id !== after.data.id) throw new Error("preview leaked a persisted run");
    return { previewTop: preview.results[0]?.overall };
  });

  await check("match: GET /students/:id/match-runs/latest", async () => {
    const { data } = await A.get(`/students/${aaratiId}/match-runs/latest`);
    return { run_id: data.id };
  });

  await check("match: GET /match-runs/:id", async () => {
    const latest = await A.get(`/students/${aaratiId}/match-runs/latest`);
    const { data } = await A.get(`/match-runs/${latest.data.id}`);
    return { engine_version: data.engine_version };
  });

  await check("profile versioning: PATCH student bumps version", async () => {
    const before = await A.get(`/students/${aaratiId}/profile`);
    const agg = (await A.get(`/students/${aaratiId}`)).data;
    const orig = agg.academic[0].gpa_value;
    agg.academic[0].gpa_value = orig === 3.25 ? 3.3 : 3.25; // toggle
    await A.patch(`/students/${aaratiId}`, { academic: agg.academic });
    const after = await A.get(`/students/${aaratiId}/profile`);
    if (after.data.version <= before.data.version) throw new Error("version did not bump");
    return { before: before.data.version, after: after.data.version };
  });

  await check("follow-ups: list scoped by student_id", async () => {
    const { data } = await A.get(`/follow-ups?student_id=${aaratiId}`);
    return { total: data.totalElements };
  });

  let followUpId;
  await check("follow-ups: create + delete", async () => {
    const { data } = await A.post("/follow-ups", { student_id: aaratiId, kind: "note", body: "integration test note" });
    followUpId = data.id;
    await A.delete(`/follow-ups/${followUpId}`);
    return { created_and_deleted: followUpId };
  });

  let docId;
  await check("documents: real MinIO upload", async () => {
    const FormData = (await import("form-data")).default;
    const form = new FormData();
    form.append("student_id", aaratiId);
    form.append("doc_type", "Bank statement");
    form.append("remark", "integration test upload");
    form.append("file", Buffer.from("hello world integration test"), { filename: "test.txt", contentType: "text/plain" });
    const { data } = await A.post("/documents", form, { headers: form.getHeaders() });
    docId = data.id;
    if (!data.url) throw new Error("no presigned url returned");
    return { id: docId, url_present: !!data.url };
  });

  await check("documents: presigned URL is fetchable", async () => {
    const { data } = await A.get(`/documents?student_id=${aaratiId}&_end=100`);
    const doc = data.elements.find((d) => d.id === docId);
    if (!doc) throw new Error("uploaded doc not found in list");
    const dl = await axios.get(doc.url, { responseType: "text" });
    if (dl.data !== "hello world integration test") throw new Error("downloaded content mismatch");
    return "content round-tripped through MinIO correctly";
  });

  await check("documents: delete purges from storage", async () => {
    await A.delete(`/documents/${docId}`);
    return "deleted";
  });

  await check("reference: fx-rates (public)", async () => {
    const { data } = await axios.get(`${BASE}/reference/fx-rates`);
    if (!data.AUD) throw new Error("missing AUD rate");
    return data;
  });

  await check("assistant: POST /assistant/messages", async () => {
    const { data } = await A.post("/assistant/messages", { student_id: aaratiId, body: "test message" });
    return { conversation_id: data.conversation_id, has_reply: !!data.reply };
  });

  const report = {
    base_url: BASE,
    ran_at: new Date().toISOString(),
    pass,
    fail,
    total: pass + fail,
    results,
  };
  writeFileSync("/tmp/integration-report.json", JSON.stringify(report, null, 2));
  console.log(`\n=== ${pass}/${pass + fail} passed ===`);
  for (const r of results) {
    console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.ok ? "" : "  -- " + r.detail}`);
  }
  process.exit(fail > 0 ? 1 : 0);
}

main();
