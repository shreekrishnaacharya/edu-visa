// ---------------------------------------------------------------------------
// Ingests the ORIGIN-country rules a Nepali applicant is bound by, which the
// corpus had none of: 10 visa_guidance documents, all Australian, and 7 of 240
// chunks mentioning Nepal at all.
//
// Australia's side was already covered by primary sources (DHA Procedural
// Instruction VM-3680 and the LIN 19/198 financial-capacity instrument — the
// latter re-checked on legislation.gov.au, still at compilation F2024C00445 of
// 10 May 2024, so what we hold is current). What was missing is the half of the
// process Nepal itself controls: a Nepali citizen needs the Ministry's written
// permission to leave for study at all, and Nepali banks will not remit tuition
// without it. A student can satisfy every Australian requirement and still be
// unable to go.
//
// SOURCING DISCIPLINE — the same rule the catalogue follows. Every claim below
// names the source it came from in the text itself, so a retrieved chunk carries
// its own provenance. Where sources conflict, the conflict is recorded rather
// than resolved by picking one. Where a figure could not be confirmed against a
// primary source it is listed as unconfirmed instead of being stated — the NOC
// fee and the Nepal Rastra Bank remittance ceilings are in that category: they
// appear in commercial and news sources with differing numbers, they change by
// circular, and a wrong figure in a student's financial plan is the exact harm
// this rule exists to prevent.
//
// Tagged country 'NP', which only became retrievable once the assistant stopped
// pinning retrieval to country='AU' (see RetrievalService.RetrievalFilters).
//
// Run: node scripts/ingest-nepal-origin-rules.mjs
// ---------------------------------------------------------------------------
import axios from "axios";

const BASE = process.env.BASE_URL || "http://localhost:3000";

const nocText = `NEPAL — NO OBJECTION CERTIFICATE (NOC) FOR STUDYING ABROAD

WHY THIS MATTERS: this is an exit requirement imposed by Nepal on its own
citizens, separate from and additional to any Australian visa requirement. A
student who meets every Subclass 500 criterion still cannot lawfully leave for
study, and cannot pay their institution through a Nepali bank, without it.

LEGAL BASIS. Nepal's Scholarships Act requires prior ministerial approval before
a citizen goes abroad for higher study. The provision, as published in English by
the Nepal Law Commission (section 27A, "No objection letter is required"), reads:
"A citizen of Nepal who wants to go abroad for higher study shall produce an
application before the Ministry of Education in a format prescribed in
schedule-4, for a no objection letter with the fees as prescribed by Government
of Nepal publishing notice in Nepalese Gazette." It continues: "While making an
inquiry into the application received, if the content of the application is found
appropriate, the Ministry of Education shall issue a no objection letter to the
applicant in a prescribed format of schedule 5. If the application is not found
appropriate, the Ministry shall inform the applicant accordingly along with the
reasons." Source: lawcommission.gov.np, published English text of the Act.

ISSUING AUTHORITY AND HOW TO APPLY. The No Objection Certificate is issued by the
Ministry of Education, Science and Technology (MoEST) of the Government of Nepal.
Applications are made online through the Ministry's official portal at
https://noc.moest.gov.np — the student registers with a phone number and email
and confirms via an OTP sent to the mobile number.

WHAT THE NOC IS NEEDED FOR. Per the British Council's report on the scheme
(28 March 2024), the certificate: permits the student to leave the country for
study; allows payment transfers to the foreign institution; evidences the
student's financial capability to fund their studies; and makes the student
eligible for government support services for studying abroad. The same source
states that without a valid NOC naming the specific university, "banks reject the
fund transfers". PRACTICAL CONSEQUENCE: the NOC must name the institution the
student is actually paying, so a change of institution after the NOC is issued is
not a paperwork detail — it can block tuition payment.

PROCESSING TIME. The British Council reports standard processing of "between 2-3
working days after the documents are verified", and that students are "advised to
apply one month before their visa deadline". That same report documents a
substantial backlog in March 2024, when applications reached around 2,000 a day
against roughly half that in processing capacity, attributed to a surge in
applications, understaffing and technical faults. Treat the 2-3 day figure as the
ministry's intended turnaround, not a guarantee, and plan against the deadline.

COURSE-TYPE ELIGIBILITY — CONFLICTING SOURCES, VERIFY BEFORE ADVISING. The
British Council report (March 2024) states the government restricted access so
that students cannot pursue "language courses and diploma/certificate
programmes", and that institutions must be on the Ministry's approved list.
Commercial Nepali education-consultancy sources instead state that an NOC is
required for, and available to, diploma, bachelor, master and language
programmes. These cannot both describe the current position. The rules have been
amended repeatedly, so for any non-degree programme the course-type eligibility
must be checked on the MoEST portal for that specific course and destination
before it is relied on. Do not tell a student a language or diploma programme is
or is not permitted on the strength of this document.

NOT CONFIRMED IN THIS DOCUMENT — DO NOT QUOTE FIGURES FOR THESE. The current NOC
application fee; the exact required-document checklist; and the Nepal Rastra Bank
foreign-exchange ceilings for tuition and living-expense remittance. Each of
these appears in secondary sources with differing values and each is set by
instrument or circular that is amended often. They need a primary source — the
MoEST portal or notice for the fee and documents, and the current Nepal Rastra
Bank unified circular on foreign exchange for the remittance limits — before any
figure is given to a student.`;

const contextText = `NEPAL — APPLICANT CONTEXT FOR ASSESSING AUSTRALIAN STUDY APPLICATIONS

This consultancy's applicants are Nepali. The following is context for reading
the other documents in this corpus correctly. It states no requirement of its own
and should never be cited as the source of a rule.

TWO JURISDICTIONS APPLY AT ONCE. An applicant must satisfy Australian
requirements (Subclass 500: genuine student criterion, English, financial
capacity, health cover — see the Department of Home Affairs Procedural
Instruction VM-3680 and the LIN 19/198 financial-capacity instrument held in this
corpus) AND Nepal's own requirement for ministerial permission to study abroad
(see the No Objection Certificate document). Advice that covers only the
Australian half is incomplete.

CURRENCY. Household income, sponsor income and savings are usually declared in
Nepali rupees, and Nepali financial documents and agent briefings commonly state
amounts in lakh: one lakh is 100,000. Several institution briefings in this
corpus set their income floors in NPR lakh rather than AUD — Central Queensland
University, for example, states its threshold that way. This system converts such
figures to AUD itself using its own recorded exchange rate; use the converted
figure it gives you and do not perform the conversion independently.

ACADEMIC CREDENTIALS. Applicants hold qualifications from Nepali institutions —
Tribhuvan University, Pokhara University, Kathmandu University and others — plus
the National Examination Board (NEB) for school-level results. Results arrive on a
4.0 CGPA scale, as a percentage, or as a division (first/second/third). This
system converts all of these to a single canonical score out of 100 before any
comparison against an institution's entry bar; the converted score is what the
eligibility verdict uses. Institution briefings sometimes state the same bar in
the local convention — the University of Newcastle's undergraduate band is
recorded as "2.80 CGPA (Nepal /4.0 convention)" — which is why the conversion
happens centrally rather than per report.

RULES WRITTEN FOR OTHER COUNTRIES DO NOT APPLY. Some institution briefings in
this corpus contain region or board restrictions scoped to a different country.
Both such restrictions on file name Indian state boards: the University of
Newcastle lists the Indian state boards it accepts, and Central Queensland
University excludes degrees from Haryana, Punjab and Rajasthan. Neither applies to
a Nepali applicant, and neither should be presented to one as a requirement or a
risk.

WHERE THIS CORPUS IS THIN ON NEPAL. There is no Nepal-specific Department of Home
Affairs evidence-level or immigration-risk guidance in this corpus, and no
Nepal-specific document checklist. Where a point is known to vary by the
applicant's country and only generic guidance is held, say the Nepal-specific
position is unconfirmed rather than presenting the generic rule as if it settled
the question.`;

const items = [
  {
    source_url: "https://noc.moest.gov.np",
    text: nocText,
    meta: {
      title:
        "Nepal — No Objection Certificate (NOC) for study abroad: statutory basis (Scholarships Act s.27A), issuing ministry, purpose, processing time and unconfirmed items",
      doc_type: "visa_guidance",
      country: "NP",
      publisher:
        "Government of Nepal — Ministry of Education, Science and Technology (portal); statutory text via Nepal Law Commission; process detail via British Council",
      effective_date: "2024-03-28",
      review_by: "2026-12-31",
    },
  },
  {
    source_url: "",
    text: contextText,
    meta: {
      title:
        "Nepal — applicant context for assessing Australian study applications (currency, credentials, two-jurisdiction process, and what this corpus lacks)",
      doc_type: "visa_guidance",
      country: "NP",
      publisher:
        "This consultancy — internal reading guide compiled from the sourced documents in this corpus; states no rule of its own",
      effective_date: new Date().toISOString().slice(0, 10),
      review_by: "2027-03-31",
    },
  },
];

const main = async () => {
  const { data: login } = await axios.post(`${BASE}/auth/login`, {
    email: "admin@edu-visa.local",
    password: "password123",
  });
  const A = axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${login.access_token}` } });
  const { data } = await A.post("/knowledge/ingest-text", { items });
  console.log(JSON.stringify(data, null, 2));
};

main().catch((e) => {
  console.error(e?.response?.data ?? e.message);
  process.exit(1);
});
