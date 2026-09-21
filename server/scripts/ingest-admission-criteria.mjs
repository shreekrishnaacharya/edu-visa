// Ingests the 9 real institution admission-criteria documents (see
// src/modules/admission/admission-policy.data.ts for the structured/typed
// version used by the deterministic eligibility checker) into the RAG KB as
// well, so broader/fuzzier questions that don't hit the orchestrator's exact
// institution-name match can still surface this via normal retrieval.
// None of these have a public URL — provided directly to the consultancy —
// same honesty pattern as the Home Affairs Procedural Instruction ingestion.
import axios from "axios";

const BASE = process.env.BASE_URL || "http://localhost:3000";

const items = [
  {
    source_url: "",
    text: `Nepal Updates 2026 — University of Tasmania (UTAS), Nepalese applicants
1. Married Cases: Marriage duration for PG students - minimum 12 months. Spouse must be similarly educated. Married cases, UG - Reject. If bringing children = reject.
2. Financial Conditions and Sponsor Requirements: For salary sponsorship - 12 months of salary evidence required (work letter stating salary, pay slips, bank account salary is paid into). For rental income evidence - 12 months of evidence required (rental contract, proof of asset ownership, evidence of rental payment). No cash payments allowed for proof of income - must be payslips. Agricultural income can be included as a source but sponsors must meet the AUD 26,000 sponsorship annual income floor without it (agricultural income used as additional income only). Male students - 70% sponsorship from parents. Female students - 70% from parents or in-laws. Business audit report requested from sponsors with business income.
3. Financial Conditions and Available Funds: Funds in fixed deposits must have been in the account at least 6 months. Land/asset sale not accepted for funding unless funds have then sat in account 6+ months (or, if under 12 months, evidence of the sale is required to track funds). Parents' combined income must be at least AUD 15,000/yr, unless that income has since lapsed. Education loans allowed, but must be accompanied by savings of AUD 12,000-15,000 shown in-account for a minimum of 6 months. Kumari Bank, Prabhu Bank and Prime Bank not accepted for education loans. Loans must be in the sponsor's name with collateral as security.
4. Academics: No English packages offered (direct-entry English score only).`,
    meta: {
      title: "UTAS (University of Tasmania) — Nepal-specific GS/financial admission update, July 2026",
      doc_type: "entry_requirement",
      country: "AU",
      institution: "University of Tasmania (UTAS)",
      publisher: "University of Tasmania — partner/agent update (provided directly to this consultancy)",
      effective_date: "2026-07-01",
      review_by: "2027-01-01",
    },
  },
  {
    source_url: "",
    text: `Sydney Met (formerly MIT Sydney) — Updated Entry Requirements for Offshore Students, Effective 16 January 2026
Following an 8 January 2026 update to Australia's student-visa country assessment levels, several South Asian countries including Bangladesh, Bhutan and Nepal are now Assessment Level 3. Sydney Met's Assessment-Level-3 rules: (1) Direct Bachelor's/Master's degree entry only - packaged Diploma or English pathway programs are NOT accepted, except: packaged English (up to 12 weeks EAP via an approved partner college) is available ONLY for Bachelor of Social Work and Master of Social Work (Qualifying), and only when the applicant is within 1-2 bands of the course's IELTS 7.0-per-band requirement. (2) Eligible intakes: May 2026, September 2026, February 2027, for students who completed high school in 2025. India offshore entry requirements communicated separately. The minimum academic and English requirements themselves are stated to be unchanged across assessment levels - what changed for Assessment Level 3 is pathway/package availability, not the score bars.
Minimum Entry Requirements table (same for Assessment Levels 1/2 and Level 3):
- Bachelor of Social Work: 65% from Year 12; IELTS 7.0 each band; PTE 65 each band.
- Bachelor of Information Technology: 60% from Year 12; IELTS 6.0 overall (no band below 5.5); PTE 50 overall (no band below 42).
- Bachelor of Business (Entrepreneurship): 60% from Year 12; IELTS 6.0 overall (no band below 5.5); PTE 50 overall (no band below 42).
- Master of Social Work (Qualifying): 65% from bachelor's (AQF7); IELTS 7.0 each band; PTE 65 each band.
- Graduate Diploma/Certificate in Human and Community Services: 65% from bachelor's (AQF7); IELTS 6.5 each band; PTE 58 each band.
- Master of Information Technology: 60% from bachelor's (AQF7); IELTS 6.5 overall (no band below 6.0); PTE 58 overall (no band below 50).
- Master of Business Administration: 60% from bachelor's (AQF7); IELTS 6.5 overall (no band below 6.0); PTE 58 overall (no band below 50).
Study gap: High School 2025 pass-outs eligible for May 2026/Sept 2026/Feb 2027 intakes only. Undergraduate completion: postgraduate eligibility valid up to 7 years from completion. Marriage status: undergraduate applicants must not be married; postgraduate married applicants are accepted.
Contact: admissions@sydneymet.edu.au, gs@sydneymet.edu.au, student.recruitment@sydneymet.edu.au.`,
    meta: {
      title: "Sydney Met — Updated Entry Requirements for Offshore Students, Assessment Level 3 (incl. Nepal), effective 16 Jan 2026",
      doc_type: "entry_requirement",
      country: "AU",
      institution: "Sydney Met",
      publisher: "Sydney Met — Head of Student Recruitment and Social Media (partner/agent update, provided directly to this consultancy)",
      effective_date: "2026-01-16",
      review_by: "2026-07-16",
    },
  },
  {
    source_url: "",
    text: `University of Newcastle (UON) — agent update
Intakes: Jan, May and Aug 2026. Age limit: UG below 21 years, PG below 32 years. UG: must have 2.80 CGPA (/4.0), IELTS 6.0 (no band below 6.0) or equivalent. PG: must have at least 55%, IELTS 6.5 (no band below 6.0) or equivalent. Backlogs: 4-year Bachelor up to 20 acceptable, 3-year Bachelor up to 10 acceptable. 1 year tuition fee must be deposited for a CoE. No fixed minimum number of sponsors. Accepted sponsors: parents, siblings, grandparents, spouse, in-laws, paternal/maternal uncles & aunts (only if parents are not alive or separated). Newcastle only accepts 20% of income from secondary sources (incl. a sibling with Australian temporary residency) - 80% must be demonstrated by the primary sponsor (parents/grandparents). Full sponsorship from grandparents acceptable, but not from siblings. Aunties/uncles/cousins not accepted unless strong ties demonstrated. In-laws: maximum 50% even if applying single. Dependant (spouse) must have equal qualification even when the applicant applies single. Proof of relationship from a Central Authority (not local government) required whenever the sponsor isn't a parent. Any income source type (vehicle, agriculture etc.) acceptable with supporting documents, but not as the majority source. All banks classified "A class" by DHA/Nepal Rastra Bank accepted. Up to 6-month-old funds acceptable; additional savings not mandatory. Visa refusal policy: a recent refusal is not acceptable; an Australian student-visa refusal is acceptable if academic progression is evident since; Australian tourist-visa refusal or refusal from another country is case-by-case; no refusals accepted on the spouse's record. Double Master's acceptable if career progression is evident and the new Master's is in a different field. India: only Andhra Pradesh, Telangana, Tamil Nadu, Karnataka, Kerala, West Bengal, Maharashtra and Gujarat state boards currently accepted.
Reference: https://www.newcastle.edu.au/study/international/the-university-in-your-country/uon-agents/entry-requirements`,
    meta: {
      title: "University of Newcastle (UON) — real entry-requirement and sponsor-rule briefing",
      doc_type: "entry_requirement",
      country: "AU",
      institution: "University of Newcastle",
      publisher: "University of Newcastle — partner/agent briefing (provided directly to this consultancy)",
      review_by: "2026-12-31",
    },
  },
  {
    source_url: "",
    text: `Torrens University and Blue Mountains International Hotel Management School — GTE update
All GS documents must be notarized. Only 3 sponsors allowed: 2 must be the applicant's parents, plus 1 additional nominated sponsor (uncle/maternal uncle/brother/sister). 70% of income must come from parents; overseas income only accepted from the applicant's own mother/father (not other sponsors). Pension income not accepted. Rental or vehicle income capped at 30% of total declared income. More than a 5-year gap after Bachelor's not acceptable (Master of Philosophy allows up to 10 years for applicants with under 10 years post-bachelor gap). Overseas income acceptable only from applicant's own parents. Double Master's not acceptable. Dependant cases acceptable case-by-case, must confirm with the university first. If married but applying single, spouse's equal qualification not mandatory; spouse and in-laws may sponsor, but parents must still hold the majority of income. Rent/lease: tenant must show the rent amount deposited 6 times in the landlord's bank statement (monthly or every 3 months). Excluded banks: Prime, Prabhu, Kumari, Laxmi Sunrise, all government banks. No backlogs or Year 12 grade-improvement certificates accepted at all. Business income must be evidenced via a bank statement in the business's own name (personal statement of the owner not acceptable). Annual income requirement: AUD 21,000 (both Torrens and Blue Mountains). No visa refusals accepted from any country except the United States. 2 years' tax clearance required (incl. rental income). One year of bank statements required. GSR-process applicants must show a minimum savings balance of NPR 15 lakh.`,
    meta: {
      title: "Torrens University / Blue Mountains — GTE / admission update",
      doc_type: "entry_requirement",
      country: "AU",
      institution: "Torrens University",
      publisher: "Torrens University / Blue Mountains — partner/agent update (provided directly to this consultancy)",
      review_by: "2026-12-31",
    },
  },
  {
    source_url: "",
    text: `Southern Cross University (SCU) — Provisional Offer Checklist, Nepalese Applicants (version 20260107)
For use by Nepalese applicants with a provisional offer at SCU's main campuses (Lismore, Coffs Harbour, Gold Coast). Applicants must satisfy SCU's Genuine Student (GS) and financial capacity requirements before accepting an offer.
PART 1 - Genuine Student (GS) Statement: must address, with documentary evidence (not just assertion): why study in Australia specifically at SCU/this campus and course; evidence of research into living/studying in Australia; evidence the applicant considered studying at home first and why Australia/SCU was still chosen. Must disclose ALL formal qualifications commenced (regardless of completion) with English transcripts. Must disclose full immigration history (Australia and any country) with a dates/locations summary and copies of visas/CoEs; any visa cancellation or refusal in the last 5 years must be disclosed and explained, considered case-by-case. Must disclose any relatives in Australia (location, relationship, visa/citizenship status). Must disclose any spouse or dependent children even if not accompanying — if married, spouse's job/education/marriage date plus marriage certificate and spouse's transcript/CV required; if dependent children, birth certificates required (SCU reviews family details even for undergraduate Diploma/Bachelor where accompanying family isn't permitted). Study gaps of 6+ months must be explained with evidence (e.g. an employer letter); gaps within a year-long/multi-year course of scheduled breaks are not "study gaps."
PART 2 - Financial capacity: SCU permits 2 sponsors only per student (parents count as 1 combined sponsor). Key financial documents by source: Salaried sponsor - visiting card for bank officials (mandatory), offer+experience letter, 6 months' salary slips and bank statements, 2 years' Tax Clearance Certificates, TDS certificate if employment under 6 months old. Business income - business registration certificate, PAN registration, 2 years' Tax Clearance Certificates, 6 months' business (or personal, if no business account) bank statements, partnership deed if applicable (agricultural/animal husbandry income accepted if verifiable via bank credits). Rental/vehicle income - property ownership document + English translation, rental agreement/lease deed + translation, 6 months' rental tax receipts, 6 months' bank statements of rental credits, land/property tax document (1-2 years + translation), tenant ID, and for vehicle income also the Blue Book and Road Tax + translation. Foreign employment - visa copies with immigration stamps (last 2 years), employment proof, 6 months' salary slips and foreign bank statements + translation, Nepal bank statements showing remittances, work permit/driving licence/ID. Education loan - coloured loan sanction letter with collateral, property ownership document + translation, mortgage deeds + translation, land/property tax document 1-2 years + translation. Fixed deposits - FD statement + holder name, source-of-funds evidence (not required if FD older than 6 months), bank balance certificate. Savings - 6 months' bank statements showing how savings were built, source-of-funds evidence, relationship of account holder to student if not in the student's own name (immediate family only, except demonstrable special circumstances). Acceptable financial institutions list is maintained via the NRB (Nepal Rastra Bank) online register. This is a post-offer/pre-visa checklist, not the academic entry-score requirement (that's set in separate SCU material).`,
    meta: {
      title: "Southern Cross University (SCU) — Provisional Offer / GS & financial checklist, Nepalese applicants",
      doc_type: "entry_requirement",
      country: "AU",
      institution: "Southern Cross University",
      publisher: "Southern Cross University (provided directly to this consultancy)",
      effective_date: "2026-01-07",
      review_by: "2026-07-07",
    },
  },
  {
    source_url: "",
    text: `ACAP (Australian College of Applied Psychology) University College — Navitas — admission update
ACAP now offers MBA and MPA at the Perth campus from Feb 2026 intake. MBA/MPA entry: AQF level 7 bachelor completed; IELTS overall 6.5 with each band 6.0 (PTE overall 59, each band 52); MBA only requires 3 years of work experience. General academic requirements: Bachelor 2.6 CGPA (/4.0); Master's 60% (55% for Graduate Certificate of Human Services); PCL 70%. English test table: BSW & MSWQ - IELTS 7.0 each band, PTE 66 each band, TOEFL 94 each, Cambridge CAE 185 each. Master's/Grad Cert/Grad Diploma - IELTS 6.5 overall (6.0 each band), PTE 59 (52 each band), TOEFL 79 (60), Cambridge CAE 176 (169). Bachelor's/Diploma - IELTS 6.5 (6.0 each band), PTE 59 (52), TOEFL 60 (46), Cambridge CAE 169 (162). Backlogs: none accepted in Year 12; up to 8 considerable in a bachelor degree. Study gap of 3+ years accepted for postgraduate only. Income thresholds: single applicant NPR 22 lakh/yr, with dependant NPR 28 lakh/yr. Sponsors: self/parents/siblings/grandparents (single applications); paternal uncle/aunt capped at 20% (single only); parents-in-law accepted for dependant applications; in-laws capped at 40% for the MBA/MPA cohort (remaining 60%+ from parents/siblings/spouse). Up to 3 sponsors accepted. Excluded bank: Prabhu Bank. Funding via education loan or savings, loan sanction must be in the applicant's parents' name, no bulk deposits accepted. Agriculture income and vehicle income NOT accepted. Parents' recently-started employment (1-2 years) not accepted. Dependant (accompanying spouse) cases require a marriage of at least 1 year. GS is conducted as question-and-answer rather than a written SOP. Scholarships: AUD 3,000 for the first 15 students, AUD 5,000 for the first 6 students from Asia (time/cohort-limited, reconfirm current availability). Suggested (not mandatory) education-loan sizing given exchange rates for CSUSM/ACAP/SAE: UG ~NPR 6,500,000, PG ~NPR 7,000,000; full disbursement is not required for a CoE; all "A class" Nepal banks accepted except Prabhu. UG courses: Bachelor of Counselling; Bachelor of Psychological Science; Bachelor of Psychological Science and Criminology; Bachelor of Psychological Science and Counselling; Bachelor of Social Work. PG courses: Graduate Certificate of Human Services (GCHS); Master of Social Work (Qualifying); Graduate Certificate of Counselling (GCC); Master of Counselling and Psychotherapy.`,
    meta: {
      title: "ACAP University College (Navitas) — entry requirements, sponsor rules and scholarships",
      doc_type: "entry_requirement",
      country: "AU",
      institution: "ACAP University College",
      publisher: "ACAP University College / Navitas — partner/agent update (provided directly to this consultancy)",
      review_by: "2026-12-31",
    },
  },
  {
    source_url: "",
    text: `Excelsia College — admission update
Bank statement windows: 10 months for a Research program, salary income and rental income; 6 months for all other programs/sources. Scholarships: 20% for Bachelor of Information Technology if GPA above 3.2 (income floor reduces to NPR 20 lakh with this scholarship, vs the general NPR 22 lakh); 25% for Bachelor of Information Technology and Music courses generally (audition compulsory for Music). Early Childhood courses: female applicants only. UG: 2.80 CGPA (/4.0) recent pass-outs, with EPT 6.0 (6.0) score, accepted up to Feb 2026 intake provided the visa is lodged by Dec 2025 (time-bound, reconfirm currency). No gap year - course must be completed within the stipulated time. PG: requires 1st Division stated on the provisional/original certificate, IELTS 6.5 (6.0 each band); OR 2.8 CGPA (/4.0) acceptable if no division is stated on any academic document. Course must be completed on time. No double Master's accepted. A 3-year BSW graduate needing to apply for a Graduate Certificate leading to a Master's requires IELTS 6.5 (6.0 each band). Research programs (Business Research, Education Research, Education Research STEM) require an EOI first. No agent changes mid-process. Detailed SOP required; no mandatory GS interview. No limit on number of sponsors; only parents, siblings, grandparents from either side accepted as sponsors. Income thresholds: single applicant (incl. married-but-applying-single) NPR 22 lakh; married with a child, applying single, NPR 25 lakh; with dependant NPR 28-30 lakh. No married applicants accepted for undergraduate programs. Age limits: recent pass-outs only for UG; 28 for PG; 33-35 for research courses; no U18 applicants under any program. PCL pass-outs not accepted. No visa refusals accepted. Marriage must be at least 1 year old and marriage photos are mandatory; spouse must hold an equal qualification; a husband may sponsor a female applicant applying single, and in-laws may sponsor a female applicant if the husband holds an equal qualification; if the applicant has a child, the dependant-qualification requirement does not apply. Agriculture income not accepted (agro-business income is); vehicle income accepted only with itemised statements (private-vehicle rent not accepted; bus/truck/heavy-vehicle rent is). Business income: approx. 70% of ITR-reported transactions must appear in bank statements, personal statements acceptable, no audit/CA report required. Foreign income from parents needs no remittance slips; foreign income from siblings does. Only the remitted amount counts toward annual income. Excluded banks: Prabhu, Prime, Kumari, Citizens, Government banks. No cooperative-society statements accepted. Full loan disbursement plus 1 year's tuition fee payment required.`,
    meta: {
      title: "Excelsia College — real entry requirements, income thresholds and admission rules",
      doc_type: "entry_requirement",
      country: "AU",
      institution: "Excelsia College",
      publisher: "Excelsia College — partner/agent update (provided directly to this consultancy)",
      review_by: "2026-12-31",
    },
  },
  {
    source_url: "",
    text: `Central Queensland University (CQU) — admission update
CQU requires HSEB/parixya-board verification and a stamped academic transcript from the issuing institution before any GS submission is accepted. Brisbane campus offers: Bachelor of Nursing, Master of Project Management, Master of Construction Management. Scholarships: UG GPA 2.8-3.19 -> 15%, 3.2-3.39 -> 20%, 3.4+ -> 25%; PG (4-year bachelor entrants) 60-69.99% -> 15%, 70-74.99% -> 20%, 75%+ -> 25%; a flat 25% is available to all applicants meeting entry requirements, for the whole program duration, once. Bachelor of Nursing English: IELTS overall 7 (L7 R7 S7 W6.5) or PTE overall 65 (L65 R65 S65 W56). Academic requirements: UG 3 CGPA (/4.0) or 75%, IELTS 6.0 (no band below 5.5) or PTE 58 (no band below 50); PG 65% for medical programs, 70% for engineering programs (incl. Master of Project Management, Master of Construction Management), 60% for management programs, IELTS 6.0 (5.5) or PTE 58 (50); Diploma/PCL 65% (health science) or 75% (other). Backlogs: UG acceptable if resolved within a year; PG not more than 6-7 with a justified reason. Sponsors: father, mother, siblings, grandparents (paternal & maternal), in-laws - maximum income must come from parents for both single and married applicants; collateral for a loan may come from grandparents or in-laws; up to 3 sponsors. Income thresholds: single applicant NPR 22 lakh, married applicant NPR 27 lakh. Australian temporary-residency income not accepted. Bank statements: 12 months preferred, 6-9 months case-by-case. If savings/FD shown instead of a loan, 1 year of statement history required. Loan sanction letter must state the loan disburses only after the applicant completes the CQU course. All "A class" commercial banks accepted. India: degrees from Haryana, Punjab and Rajasthan not accepted. Marriage: no fixed rule on date/registration, only a marriage certificate required; a spouse with a +2 (Year 12) qualification is acceptable for a Master's-level applicant. No double Master's (a double-Master's applicant can instead apply for a research course). No refusals accepted from any country. No U18 applicants; no age limit otherwise stated. No ELICOS or pathway packages offered. November intake: research/PhD only. 300-word SOP required at GTE stage; an interview is conducted before the offer letter is issued (family income discussed during GS). 1 year tuition fee must be paid for a CoE for a Master's program; 1 year + 1 semester for a Bachelor's program. Indicative turnaround: Offer 3-4 days, GS 1-2 days, CoE 2 days.`,
    meta: {
      title: "Central Queensland University (CQU) — real entry requirements, scholarships and sponsor rules",
      doc_type: "entry_requirement",
      country: "AU",
      institution: "Central Queensland University",
      publisher: "Central Queensland University — partner/agent update (provided directly to this consultancy)",
      review_by: "2026-12-31",
    },
  },
  {
    source_url: "",
    text: `Curtin College, Griffith College and Eynesbury College — 2026 Genuine Student (GS) requirements update
1. Annual income requirement: minimum NPR 22 lakh and above.
2. Acceptable sponsors — Primary (80%), strongly recommended: parents, grandparents, siblings. Secondary (20%), limited use, NOT available at Curtin College at all: uncle/aunt, spouse (married applicants only), in-laws (case-by-case). Not accepted under any circumstances: brother-in-law/sister-in-law.
3. Funding requirements: education loan (must be from primary sponsors, collateral also from primary sponsors) OR savings (must be from primary sponsors, requires 6 months' bank statement with supporting documents).
4. Bank statement requirements: salary/business/pension/agriculture/vehicle income - minimum 1-year bank statement showing consistent income deposits; rental income - minimum 6 months' bank statement based on the agreement start date, 1 year highly recommended.
This update covers GS/sponsor/funding criteria only — no academic or English-score thresholds were included.`,
    meta: {
      title: "Curtin College / Griffith College / Eynesbury College — 2026 Genuine Student (GS) requirements",
      doc_type: "entry_requirement",
      country: "AU",
      institution: "Curtin College",
      publisher: "Curtin College / Griffith College / Eynesbury College — partner/agent update (provided directly to this consultancy)",
      review_by: "2026-12-31",
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
