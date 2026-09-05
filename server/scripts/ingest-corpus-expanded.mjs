// Expanded real corpus, round 2 — broadens coverage across the full student
// journey (onboarding → course selection → application → visa → arrival →
// settling → work → post-study), still official/institutional sources only.
import axios from "axios";

const BASE = process.env.BASE_URL || "http://localhost:3000";

async function main() {
  const { data: login } = await axios.post(`${BASE}/auth/login`, {
    email: "admin@edu-visa.local",
    password: "password123",
  });
  const A = axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${login.access_token}` } });

  const today = new Date().toISOString().slice(0, 10);
  const reviewBy = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  const gov = (path, title, doc_type) => ({
    url: `https://www.studyaustralia.gov.au${path}`,
    meta: { title, doc_type, country: "AU", publisher: "Australian Government (Study Australia)", effective_date: today, review_by: reviewBy },
  });

  const items = [
    // Onboarding / course selection
    gov("/en/plan-your-studies/areas-of-study", "Areas of study — choosing a field", "entry_requirement"),
    gov("/en/plan-your-studies/australias-education-system", "Australia's education system explained", "entry_requirement"),
    gov("/en/plan-your-studies/universities-and-higher-education", "Universities and higher education in Australia", "entry_requirement"),
    gov("/en/plan-your-studies/vocational-education-and-training", "Vocational education and training (VET) in Australia", "entry_requirement"),
    gov("/en/plan-your-studies/list-of-australian-universities", "List of Australian universities", "entry_requirement"),
    gov("/en/plan-your-studies/find-a-course", "How to find a course", "entry_requirement"),
    gov("/en/plan-your-studies/other-ways-to-study", "Other ways to study (pathways, foundation, bridging)", "entry_requirement"),
    gov("/en/plan-your-studies/changing-your-course-or-provider", "Changing your course or provider mid-study", "institution_policy"),
    // Family / dependants / health / logistics
    gov("/en/plan-your-move/bringing-your-family", "Bringing your family to Australia", "visa_guidance"),
    gov("/en/plan-your-move/overseas-student-health-cover-oshc", "Overseas Student Health Cover (OSHC)", "visa_guidance"),
    gov("/en/plan-your-move/language-testing-organisations", "Recognised English language testing organisations", "entry_requirement"),
    gov("/en/plan-your-move/preparing-to-travel", "Preparing to travel to Australia", "visa_guidance"),
    gov("/en/plan-your-move/what-can-i-bring-to-australia", "What you can bring to Australia", "visa_guidance"),
    gov("/en/plan-your-move/your-first-week-in-australia", "Your first week in Australia", "institution_policy"),
    // Living / settling
    gov("/en/life-in-australia/accommodation", "Student accommodation options", "cost_of_living"),
    gov("/en/life-in-australia/locations-in-australia", "Choosing a city or region to study in", "cost_of_living"),
    gov("/en/life-in-australia/safety-in-australia", "Safety in Australia", "institution_policy"),
    gov("/en/life-in-australia/student-support-services", "Student support services", "institution_policy"),
    gov("/en/why-australia/australian-culture-and-lifestyle", "Australian culture and lifestyle", "institution_policy"),
  ];

  console.log(`Ingesting ${items.length} additional real source URLs...`);
  const { data } = await A.post("/knowledge/ingest", { items });
  for (const r of data.results) {
    console.log(`${r.ok ? "✓" : "✗"} ${r.url}${r.ok ? ` (${r.chunks} chunks)` : `  -- ${r.reason}`}`);
  }
  console.log("\nStats:", data.stats);
  const fs = await import("fs");
  fs.writeFileSync("/tmp/ingest-expanded-report.json", JSON.stringify(data, null, 2));
}

main().catch((e) => {
  console.error(e?.response?.data ?? e);
  process.exit(1);
});
