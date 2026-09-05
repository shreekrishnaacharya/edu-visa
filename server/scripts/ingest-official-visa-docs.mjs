// Ingests two real, authoritative Dept. of Home Affairs documents the user
// supplied directly (server was pointed at resource/*.pdf):
//   1. Migration (LIN 19/198: Evidence of financial capacity - Subclass 500
//      Visa and Subclass 590 Visa) Instrument 2019, Compilation No. 2 (10 May
//      2024) - the actual legislative instrument that SETS the AUD29,710
//      living-cost figure (and every other financial-capacity number) we'd
//      previously only sourced secondhand from studyaustralia.gov.au.
//   2. [Sch2Visa500] Visa 500 - Student - Dept. of Home Affairs Procedural
//      Instruction (Document ID VM-3680, LEGEND version 7 Nov 2025) - the
//      internal officer-facing instruction on how Subclass 500 applications
//      are actually assessed: genuine student criterion, English language
//      evidence, financial capacity, health insurance, visa conditions,
//      grant periods. Primary-source, not a paraphrase.
// Both are read from the extracted plain-text files (see report) rather than
// re-parsed here, since the PDF->text step needs a page-range-aware reader.
import axios from "axios";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SCRATCH = "/tmp/claude-1000/-oldsystem-projects-edu-visa/2090584d-d29a-4f3a-b842-22cdf7b132ea/scratchpad";

const finText = fs.readFileSync(`${SCRATCH}/fin.txt`, "utf8");
const sch2Text = fs.readFileSync(`${SCRATCH}/sch2.txt`, "utf8");

// `source_url` MUST be a bare, clickable URL — it's rendered as an actual
// link in the frontend citation chips. Any human-readable description (which
// instrument, compilation number, etc.) belongs in `title` instead, never
// appended into the URL string (that broke citation links — see
// docs/ai-consultant-ui-2026-09-02.md follow-up). When a document genuinely
// has no public URL (like the internal PI below), leave source_url empty —
// the frontend falls back to showing the title as a non-clickable citation
// instead of a broken link.
const items = [
  {
    source_url: "https://www.legislation.gov.au/F2019L01366/latest/text",
    text: finText,
    meta: {
      title:
        "Migration (LIN 19/198: Evidence of financial capacity) Instrument 2019, Compilation No. 2, registered 17/05/2024, F2024C00445 - the legislative instrument setting AU student/guardian visa financial-capacity amounts",
      doc_type: "visa_guidance",
      country: "AU",
      publisher: "Australian Government - Department of Home Affairs",
      effective_date: "2024-05-10",
      review_by: "2027-01-01",
    },
  },
  {
    // No public URL exists for this one — it's an internal officer-facing
    // instruction, provided directly to the consultancy, not published
    // online. Left empty deliberately (not a placeholder/fake URL).
    source_url: "",
    text: sch2Text,
    meta: {
      title:
        "Department of Home Affairs Procedural Instruction VM-3680 \"[Sch2Visa500] Visa 500 - Student\", LEGEND version 07 November 2025 (internal officer guidance, provided directly as a document to this consultancy) - genuine student criterion, English language, financial capacity, health insurance, visa conditions and grant periods",
      doc_type: "visa_guidance",
      country: "AU",
      publisher: "Australian Government - Department of Home Affairs",
      effective_date: "2025-11-07",
      review_by: "2026-11-07",
    },
  },
];

async function main() {
  const { data: login } = await axios.post(`${BASE}/auth/login`, {
    email: "admin@edu-visa.local",
    password: "password123",
  });
  const A = axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${login.access_token}` } });
  const { data } = await A.post("/knowledge/ingest-text", { items });
  console.log(JSON.stringify(data, null, 2));
}
main().catch((e) => {
  console.error(e?.response?.data ?? e);
  process.exit(1);
});
