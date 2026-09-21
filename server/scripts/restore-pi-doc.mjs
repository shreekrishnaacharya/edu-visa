// One-off repair: re-ingests the Home Affairs Procedural Instruction VM-3680
// doc, which a source_url-collision bug in ingestion.service.ts (fixed
// alongside this script — dedup was keyed on the literal empty string, so
// every no-URL doc ingested after it silently deleted it) had wiped out.
import axios from "axios";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const sch2Text = fs.readFileSync(
  "/tmp/claude-1000/-oldsystem-projects-edu-visa/2090584d-d29a-4f3a-b842-22cdf7b132ea/scratchpad/sch2.txt",
  "utf8",
);

async function main() {
  const { data: login } = await axios.post(`${BASE}/auth/login`, {
    email: "admin@edu-visa.local",
    password: "password123",
  });
  const A = axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${login.access_token}` } });
  const { data } = await A.post("/knowledge/ingest-text", {
    items: [
      {
        source_url: "",
        text: sch2Text,
        meta: {
          title:
            'Department of Home Affairs Procedural Instruction VM-3680 "[Sch2Visa500] Visa 500 - Student", LEGEND version 07 November 2025 (internal officer guidance, provided directly as a document to this consultancy) - genuine student criterion, English language, financial capacity, health insurance, visa conditions and grant periods',
          doc_type: "visa_guidance",
          country: "AU",
          publisher: "Australian Government - Department of Home Affairs",
          effective_date: "2025-11-07",
          review_by: "2026-11-07",
        },
      },
    ],
  });
  console.log(JSON.stringify(data, null, 2));
}
main().catch((e) => {
  console.error(e?.response?.data ?? e);
  process.exit(1);
});
