import axios from "axios";

const BASE = process.env.BASE_URL || "http://localhost:3000";

const text = `Australian student visa (subclass 500) grant rates by education sector, Department of Home Affairs "BP0015 Student Visa Grant Rates Report" (official, data.gov.au), financial-year figures, most recent years shown below. Figures are the share of DECIDED applications that were granted (not lodged applications, and not specific to any one institution or country of citizenship — Home Affairs does not publish grant rates broken down by individual university or college).

Higher Education Sector (Bachelor's, Master's coursework, most of our AU catalogue): 2019-20 96.0%, 2020-21 87.5%, 2021-22 84.2%, 2022-23 91.9%, 2023-24 84.0%, 2024-25 70.8% (partial year to 31 July 2026 — provisional, will likely move as more decisions are finalised).

Postgraduate Research Sector (research Masters, PhD): 2019-20 97.3%, 2020-21 98.1%, 2021-22 97.8%, 2022-23 98.3%, 2023-24 95.6%, 2024-25 92.9% (partial). Consistently the highest and most stable grant rate of any sector.

Vocational Education and Training (VET) Sector: 2019-20 84.0%, 2020-21 77.0%, 2021-22 61.4%, 2022-23 58.1%, 2023-24 52.2%, 2024-25 48.4% (partial). The steepest decline of any sector — VET student visa applications have faced substantially increased scrutiny under Australia's post-2023 international education integrity reforms.

Independent ELICOS Sector (English language colleges): 2019-20 85.0%, 2020-21 91.2%, 2021-22 81.0%, 2022-23 78.8%, 2023-24 78.8%, 2024-25 67.7% (partial).

All sectors combined (Grand Total): 2019-20 91.5%, 2020-21 86.0%, 2021-22 79.8%, 2022-23 81.9%, 2023-24 78.2%, 2024-25 66.9% (partial, early in the financial year — historically the full-year figure settles higher than an early partial read).

Important limitation: this dataset breaks grant rates down by sector, education-provider registered state, citizenship country, gender, age, lodgement channel and financial year/quarter — but NOT by individual institution or specific course. There is no public dataset that publishes "University A has a higher visa grant rate than University B" — the streamlined, provider-specific risk-tiering framework that existed before 2016 was retired; today's assessment is about the individual applicant (genuine student criteria, financial capacity, immigration history), not the institution. Any specific "this university has a 95% visa success rate" claim should be treated as unsupported unless it cites this exact source with matching sector/year filters, or comes from this consultancy's own tracked case outcomes (not yet available — see the product roadmap's outcome-tracking phase).

Practical implication for advice: prefer Postgraduate Research and Higher Education (coursework) sector applications over VET or ELICOS-only pathways where a student's profile allows it, given the sustained higher and more stable grant rates in those sectors. The overall downward trend across all sectors in 2023-2025 means genuine-student and financial-evidence documentation matters more now than in prior years, regardless of institution.`;

async function main() {
  const { data: login } = await axios.post(`${BASE}/auth/login`, { email: "admin@edu-visa.local", password: "password123" });
  const A = axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${login.access_token}` } });
  const { data } = await A.post("/knowledge/ingest-text", {
    items: [
      {
        // Bare URL only — anything descriptive belongs in `title`, appending
        // it into source_url broke the citation link in the frontend.
        source_url: "https://data.gov.au/data/dataset/324aa4f7-46bb-4d56-bc2d-772333a2317e",
        text,
        meta: {
          title: "BP0015 Student Visa Grant Rates Report — Australian student visa grant rates by sector (Dept. of Home Affairs, official statistics)",
          doc_type: "visa_statistics",
          country: "AU",
          publisher: "Australian Government — Department of Home Affairs",
          effective_date: "2026-07-31",
          review_by: "2027-01-31",
        },
      },
    ],
  });
  console.log(JSON.stringify(data, null, 2));
}
main().catch((e) => { console.error(e?.response?.data ?? e); process.exit(1); });
