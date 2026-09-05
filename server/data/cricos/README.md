# Real CRICOS course/institution data

Trimmed snapshot of the **official Australian Government CRICOS register**
(Commonwealth Register of Institutions and Courses for Overseas Students),
published as open data by the Department of Education on data.gov.au — the
same system (PRISMS) that backs the CRICOS website, exported monthly.

- Dataset: https://data.gov.au/data/dataset/e5ae7059-bfa8-4fa4-a5c0-c13cf3520193
- Snapshot fetched: 2026-09-02 (source file dated 2026-08-03)
- Scope: the 8 universities already in our catalogue (Melbourne, Sydney,
  Monash, UQ, UNSW, UWA, Deakin, RMIT), non-expired courses at Bachelor /
  Bachelor Honours / Graduate Certificate / Graduate Diploma / Masters
  (Coursework, Research, Extended) / Doctoral level, with a non-empty
  `Tuition Fee`. 3,550 of the national file's 26,066 rows.
- `courses.csv` — real course names, CRICOS codes, fields of education,
  duration (weeks), **real published tuition fee, non-tuition fee, and total
  estimated cost** (the fee is for the WHOLE course, not per year — the
  importer divides by `duration_weeks/52`).
- `institutions.csv` — the 8 institutions, official CRICOS provider codes,
  trading name, postal address.

**Not in this dataset** (CRICOS doesn't publish it): per-course entry
requirements (min GPA / English band), work-experience prerequisites,
scholarships, intake dates, application deadlines. `server/src/seed/cricos-import.ts`
fills these with documented estimated defaults, **tiered by institution
selectivity** (world_rank ≤40 / ≤150 / higher → "selective"/"moderate"/
"accessible" GPA and English bars per degree level) rather than one flat
number for every university — closer to how real entry bars actually vary,
and avoids a single conservative guess locking a weaker-but-real transcript
out of the *entire* catalogue. Still clearly not government data, and should
be replaced with real per-institution admissions data as a follow-up (the RAG
knowledge base's `scholarship_terms` docs are a narrative substitute in the
meantime; and because every course defaults to `work_experience_months: 0`,
the engine's "experience preferred" scoring penalty cannot fire against this
catalogue — a modeling limitation, not a bug).

**Known data quirk, handled**: some joint/partner-institution research
degrees (e.g. "Doctor of Philosophy (Beihang - Monash)") show a `$0`–`$1`
`Tuition Fee` because the partner institution bills tuition, not disclosed in
this field — real CRICOS-registered courses, not a real domestic price. The
`Dual Qualification` column does not reliably flag these, so the importer
applies a `$3,000` minimum realistic-fee floor instead (42 of 3,550 rows
excluded on the 2026-09-02 snapshot).

**To refresh**: re-run the same `data.gov.au` `package_search?q=CRICOS`
query, download the current `CRICOS Courses.csv` / `CRICOS Institutions.csv`
resources, and re-filter with the same script used to build this snapshot
(see the overnight QA report, §2, for the exact commands).
