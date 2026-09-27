# Real CRICOS course/institution data

Offline fixture of the **official Australian Government CRICOS register**
(Commonwealth Register of Institutions and Courses for Overseas Students),
published as open data by the Department of Education on data.gov.au — the
same system (PRISMS) that backs the CRICOS website, exported monthly.

- Dataset: https://data.gov.au/data/dataset/cricos
  (CKAN id `e5ae7059-bfa8-4fa4-a5c0-c13cf3520193`; the `/dataset/cricos` slug
  resolves to the same package)
- Snapshot fetched: 2026-09-26 (source file dated 2026-08-03)
- Scope: **every** provider in the national register with at least one
  higher-ed course — Bachelor / Bachelor Honours / Graduate Certificate /
  Graduate Diploma / Masters (Coursework, Research, Extended) / Doctoral —
  that is non-expired and carries a realistic `Tuition Fee`.
  **663 institutions / 12,749 courses**, from the national file's 1,545
  providers and 26,065 course rows.
- `courses.csv` — real course names, CRICOS codes, fields of education,
  duration (weeks), **real published tuition fee, non-tuition fee, and total
  estimated cost** (the fee is for the WHOLE course, not per year — the
  importer divides by `duration_weeks/52`).
- `institutions.csv` — official CRICOS provider codes, trading name,
  institution type, student capacity, **website** (what the per-institution
  requirement scraper starts from), postal address.
- `locations.csv` — real teaching campuses per provider. Preferred over the
  postal address for deriving a campus city, because the postal field is
  sometimes a PO box or the institution's own name.

## This is the offline path, not the live one

These files seed a fresh dev database (`src/seed/cricos-import.ts`) and back the
tests. **The live path is the UI**: `Data sync → Sync CRICOS register`
(`POST /data-sync/runs/cricos`) pulls the current register straight from
data.gov.au, diffs it against the catalogue, and applies what a human accepts.
Both paths share `src/modules/data-sync/cricos-mapper.ts`, so seeding and
syncing can never produce different rows from the same source file.

There is no longer a shell script to re-cut these files by hand; run a sync from
the UI instead. To refresh the fixture itself, run a sync and re-export.

## Entry requirements are NOT in this dataset

CRICOS publishes no per-course entry requirements: no English band, no GPA, no
work-experience prerequisite, no scholarships, no intake dates, no application
deadlines.

Earlier versions of the importer **invented** the English/GPA bars from a
world-rank tier table. That is gone. Every course now imports with
`entry.min_gpa` and `entry.min_english_band` set to **null**, meaning "never
sourced", and the matching engine reports those gates as `unknown` — which
downgrades the verdict to `insufficient_data` rather than letting the course
look like a pass.

This matters more than it sounds: the previous placeholder was `0`, and the
engine's gates are `gpa + 3 < min_gpa` and `band + 0.5 < min_english_band`, so a
`0` **passed every applicant**. An unsourced course looked like it had no
English requirement at all. `test/engine-unsourced-entry.spec.ts` pins the
corrected behaviour.

Real bands are layered on afterwards, per institution, from each provider's own
admissions page — recorded in `source_page` with the URL they were read off, so
they can be re-pulled when stale. Until that runs, the honest state of a course
is "requirement not known", and the UI says so.

### How well the per-institution scraping actually works

`Data sync → Requirement sources` runs it (`POST /data-sync/runs/site-scrape`).
Measured on real runs, not estimated:

- **Roughly half the largest universities cannot be read at all.** Melbourne,
  Monash, Sydney, Newcastle and Macquarie return HTTP 403 from anti-bot
  protection, or render their navigation client-side so there are no links to
  follow. This is not bypassed. Those institutions need their requirements
  entered by hand, or sourced from a document upload.
- **Where a site is readable, the data is good.** UNSW yielded 9 real bands at
  0.90 confidence (Law & Justice 7.0, Teaching 7.5, Engineering/Science 6.5),
  each with a verbatim quote and attributed to
  `unsw.edu.au/study/how-to-apply/english-language-requirements`, covering 236
  of its 598 courses.
- **The numbers are usually one hop below the page you'd expect.** Curtin,
  Flinders and Swinburne publish an "entry requirements" hub that only *links*
  to the table, so the scraper follows English-requirement links one level
  deeper. Discovery also has to prefer `/international` over `/domestic`: the
  domestic pages carry ATAR/STAT criteria and no IELTS figures at all.
- **Coverage is per-faculty, not per-course.** Universities state bands by
  faculty ("Business", "Arts, Design & Architecture"), which is matched against
  course title and field. A faculty label that matches no course title (UNSW's
  "Business", whose courses are titled "Master of Commerce") attaches to almost
  nothing. Under-attaching is deliberate — better than assigning a bar to the
  wrong course.

Guardrails, all covered by `test/requirement-extraction.spec.ts`: a band is
discarded unless its supporting quote really appears on the page; scores outside
each test's real range are dropped; a row listing several different scores is
flagged `ambiguous` and its confidence capped, because the same UNSW row was
observed flipping between 6.5 and 7.0 across runs. Nothing is ever auto-applied,
and a human-`reviewed` `admission_policy` is never overwritten by a scrape.

## Known gaps, deliberately left visible

- **`world_rank`** is only set for the 8 institutions the original curated seed
  covered (verified against their real provider codes). The other ~655 import as
  `999` / UNRANKED, which the engine reads as "no ranking signal", not "ranked
  last". Not extended to ANU, Adelaide, UTS, Macquarie etc. because QS/THE
  tables aren't open data and typing half-remembered rank numbers in would be
  the same invented precision this pipeline exists to remove. Consequence:
  `locationScore`'s `ranking_matters && world_rank <= 60` bonus does not fire for
  genuinely top-60 universities outside that 8. Populating it needs a real
  licensed ranking source.
- **`min_gpa`** will likely stay null even after per-institution scraping:
  Australian universities publish ATAR or "recognised equivalent", not a 0-100
  GPA, and international-transcript equivalence is assessed case by case.
- **City** is a metro label derived from the campus postcode via Australia Post's
  published capital-city ranges, because the engine compares `city` literally
  against a student's `preferred_cities` and its big-city list — a raw campus
  locality ("CLAYTON", "KENSINGTON") would stop a Sydney-preferring student
  matching UNSW. Campuses outside those ranges keep their real locality.
- **Intake dates / deadlines** are forward-looking placeholders, not sourced.
- **9 aggregator-sourced institutions** (from
  `src/seed/aggregator-research-import.ts`) now duplicate real register
  providers under slightly different names, because they were added when the
  catalogue only held 8 universities. The sync deliberately ignores
  `data_confidence = 'unverified_aggregator'` rows — comparing them would let the
  register silently overwrite an aggregator fee, and some of their `cricos`
  values collide with real register course codes. Retiring those rows in favour
  of the real register data is a pending decision, not an oversight.

## Known data quirk, handled

Some joint/partner-institution research degrees (e.g. "Doctor of Philosophy
(Beihang - Monash)") show a `$0`–`$1` `Tuition Fee` because the partner
institution bills tuition, not disclosed in this field — real
CRICOS-registered courses, not a real domestic price. The `Dual Qualification`
column does not reliably flag these, so the importer applies a `$3,000`
minimum realistic-fee floor instead.
