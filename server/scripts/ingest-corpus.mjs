// Triggers ingestion of a curated, verified-reachable, robots-compliant corpus
// of REAL official Australian sources via POST /knowledge/ingest.
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

  const gov = (url, title, doc_type) => ({
    url,
    meta: { title, doc_type, country: "AU", publisher: "Australian Government (Study Australia)", effective_date: today, review_by: reviewBy },
  });

  const items = [
    gov("https://www.studyaustralia.gov.au/en/plan-your-move/visa-application-process", "How to apply for your student visa", "visa_guidance"),
    gov("https://www.studyaustralia.gov.au/en/plan-your-move/your-guide-to-visas", "Your guide to Australian student visas", "visa_guidance"),
    gov("https://www.studyaustralia.gov.au/en/life-in-australia/living-and-education-costs", "Living and education costs in Australia", "cost_of_living"),
    gov("https://www.studyaustralia.gov.au/en/plan-your-studies/how-to-apply-to-study", "How to apply to study in Australia", "entry_requirement"),
    gov("https://www.studyaustralia.gov.au/en/plan-your-studies/scholarships", "Scholarships to study in Australia", "scholarship_terms"),
    gov("https://www.studyaustralia.gov.au/en/work-in-australia/work-rights-and-responsibilities", "Work rights and responsibilities for student visa holders", "visa_guidance"),
    gov("https://www.studyaustralia.gov.au/en/work-in-australia/work-after-graduating", "Work after graduating — post-study work rights", "visa_guidance"),
    gov("https://www.studyaustralia.gov.au/en/plan-your-studies/english-courses", "English language courses and requirements", "entry_requirement"),
    gov("https://costofliving.studyaustralia.gov.au/", "Cost of living calculator — Study Australia", "cost_of_living"),
    {
      url: "https://cricos.education.gov.au",
      meta: { title: "CRICOS — Commonwealth Register of Institutions and Courses for Overseas Students", doc_type: "registry", country: "AU", publisher: "Australian Government (Dept. of Education)", effective_date: today, review_by: reviewBy },
    },
    {
      url: "https://www.rmit.edu.au/study-with-us/international-students",
      meta: { title: "International students — RMIT University", doc_type: "institution_policy", country: "AU", institution: "RMIT University", publisher: "RMIT University", effective_date: today, review_by: reviewBy },
    },
    {
      url: "https://www.sydney.edu.au/study/international-students.html",
      meta: { title: "International students — University of Sydney", doc_type: "institution_policy", country: "AU", institution: "University of Sydney", publisher: "University of Sydney", effective_date: today, review_by: reviewBy },
    },
    {
      url: "https://study.uq.edu.au/international-students",
      meta: { title: "International students — University of Queensland", doc_type: "institution_policy", country: "AU", institution: "University of Queensland", publisher: "University of Queensland", effective_date: today, review_by: reviewBy },
    },
  ];

  console.log(`Ingesting ${items.length} real source URLs...`);
  const { data } = await A.post("/knowledge/ingest", { items });
  for (const r of data.results) {
    console.log(`${r.ok ? "✓" : "✗"} ${r.url}${r.ok ? ` (${r.chunks} chunks)` : `  -- ${r.reason}`}`);
  }
  console.log("\nStats:", data.stats);
  const fs = await import("fs");
  fs.writeFileSync("/tmp/ingest-report.json", JSON.stringify(data, null, 2));
}

main().catch((e) => {
  console.error(e?.response?.data ?? e);
  process.exit(1);
});
