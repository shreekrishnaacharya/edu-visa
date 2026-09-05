# USER STORY
why this project exist?
this project edu-visa is to be an AI base project for a consultancy service office where many student visits for consulting for abroad study, or visit or work opportunity and other. and this all the detail related to the customer/student are feeded into this system and AI should act like senior consultant and suggest best consuling. such as if its a student visiting then it should be able to suggest nest approach to be taken to complete the visa application and also should suggest the best circumstances that fits best fot the student to get the best  opportunity for the student.
example. if a student arrives to desk it ans student is not sure about the country, it should suggest best sutable base on financial status, current education, and current profile, and once student has decided the country, the it should help student in selecting the university/college/city.
the ai should poses of should have access to source through rag or online resource to the colleges availabe, courses, their price, living excenses, socity/culture around it and other necessary info. also ai should have information about current rules and regulation of thet state/country or policy for immigerant process. 
this ai system should be equipted access to all necessary resource and information which an ai can access /search process and provide relevent best feedback to any asked question. also this system should automatic trach student profile , its update, preference of student.
this is overall requirment of this system.
lest first plan how we can build and what workflow / pipeline or any necessary flow we should introduct in this application.

# DEAFTED PLAN

# Edu-Visa — Next executable phase: real backend + engine port (Australia-first)

## Context

**Why this project exists.** A study/visa consultancy sees a stream of students who want to
study, work, or migrate abroad. Today course/university selection is manual, biased toward
the handful of institutions a counsellor happens to know, and disconnected from the
student's finances and visa-risk profile. Students name a university; nobody systematically
checks whether it is the *right* one for their academic record, budget, English level and
career goal. Edu-Visa turns the intake conversation into structured data and runs every
course in a maintained catalogue against that profile, returning a ranked, explained
shortlist — and, on top, an AI "senior consultant" the student/counsellor can talk to for
open questions ("not sure which country", "help me pick a city"), grounded in current
course, cost-of-living and immigration-rule information.

**Where the project stands.**
- [docs/PRODUCT_PLAN.md](docs/PRODUCT_PLAN.md) already specifies the full architecture:
  two-sided domain model (§3), the deterministic matching engine (§4, with the
  `MatchResult` contract in §4.4), a NestJS backend (§5), the AI + RAG report layer (§6),
  the end-to-end flow (§7), non-functional requirements (§8) and a P0–P4 roadmap (§10).
  **This plan does not revisit that architecture — it executes the next slice of it.**
- The **React prototype is essentially complete** for the P0–P1 browser slice: 10-section
  intake wizard, student profile view, course catalogue, and the deterministic engine
  (`deriveProfile → knockout → score → runMatch` in [src/mocks/engine/](src/mocks/engine/)),
  all running against **MSW mocks** ([src/mocks/](src/mocks/)) with no backend.
- **No backend and no AI code exist.** The "AI report" today is templated placeholder
  sentences in [src/mocks/engine/score.ts](src/mocks/engine/score.ts).

**Decisions taken for this phase** (via clarification):
1. Scope = **the next executable phase only** — not a fresh master plan.
2. Interaction model = **chat front door + deterministic engine underneath** (the chat
   agent is the *following* phase; this phase only leaves the seam for it).
3. Knowledge = **hybrid** (curated catalogue drives matching; live web + RAG corpus supply
   freshness — both are the following phase).
4. Country scope = **Australia only** for this release.

**Intended outcome of this phase.** The existing prototype UI runs unchanged in behaviour
against a **real NestJS + PostgreSQL API** instead of MSW: persistent multi-user data, real
auth/RBAC/branch tenancy, the matching engine ported server-side with persisted
`MatchRun`s, an Australia-only seeded catalogue with an admin CRUD + CSV importer, and a
dormant `assistant` module so the chat phase is a bolt-on, not a retrofit.

---

## Approach

Build a NestJS app at **`server/`** in this repo (monorepo). PostgreSQL (chosen for
`pgvector` in the AI phase) via TypeORM. Every list endpoint uses the
`@sksharma72000/nestjs-search-page` four-file pattern per [NEST_SEARCH.MD](NEST_SEARCH.MD).
The frontend keeps its MSW build working behind a `VITE_USE_MOCKS` flag during the
transition; the default build points at the real API.

The engine is a **verbatim logic port**, not a rewrite — the prototype's algorithm is the
spec, and a golden test locks the ported output to the current mock output.

### A. Backend skeleton
- `server/` NestJS + TypeORM + `pg`; `docker-compose.yml` for Postgres + Redis + MinIO.
- `src/common/dto/page.dto.ts` (shared `_start/_end/_sort/_order`), `src/common/services/common.service.ts` (`CommonService<T>` wrapping `findAllByPage`), `src/common/auth/` (JWT guard, `@AuthUser()`, roles).
- Config module (`@nestjs/config`), `/health`, global `ValidationPipe({ whitelist: true, transform: true })`.

### B. Schema — Side A + Side B (Australia-scoped)
TypeORM entities mirroring [src/mocks/types.ts](src/mocks/types.ts), **normalised** (one
table per aggregate, FK to `student` / `course`), with migrations:
- Side A: `student` (+ `branch_id`, `counsellor_id`, `consent_given_at`, `consent_version` from day one), `academic_record`, `language_test`, `work_experience`, `career_goal`, `income_source`, `asset`, `liability`, `sponsor`, `visa_history`, `dependant`, `preferences`, `student_document`, `follow_up`.
- Side B: `university`, `course`, `course_intake`, `entry_requirement`, `scholarship`.
- Derived: `student_profile` (versioned), `match_run` (+ `results` jsonb, `profile` jsonb, `profile_version`, `engine_version`, `weights`).
- `MatchResult` / `MatchRun` / `StudentProfile` TS shapes stay **identical** to
  [src/mocks/types.ts](src/mocks/types.ts) — shared as DTOs.

### C. Auth, RBAC, tenancy, PII
- JWT login/refresh; roles `student | counsellor | branch_admin | super_admin` (extend the prototype's `counsellor | branch_admin`).
- Controllers force `search.branch_id = branchId` and, for counsellors, `search.counsellor_id = userId` from `@AuthUser` — never trusted from the client.
- `visa_history` reads behind their own permission gate.
- Column-level encryption (TypeORM transformer) for passport number, all income/asset/liability/sponsor amounts, and the `visa_history` table.
- Audit-log interceptor recording who read/changed financial or visa rows.
- Consent captured (timestamped + versioned) at student create; withdrawal supported.

### D. Reference module (Australia)
- `gpa_scale`, `english_concordance`, `fx_rate` tables seeded from
  [src/mocks/db/reference.ts](src/mocks/db/reference.ts) (`toCanonicalGpa`,
  `toIeltsEquivalent`, `FX_TO_AUD`, `toAud`).
- `ReferenceService` exposes these to the profile derivation and a read endpoint for the UI.

### E. Profile module
- Port `deriveProfile` from [src/mocks/engine/derive.ts](src/mocks/engine/derive.ts)
  verbatim, backed by `ReferenceService` instead of the inline constants.
- Persist + version `student_profile`; recompute and bump `version` on **any** Side A
  write via a TypeORM subscriber / domain event. Keep it out of the intake write path.

### F. Match module
- Port `knockout` + `score` + `runMatch` from
  [src/mocks/engine/score.ts](src/mocks/engine/score.ts) /
  [src/mocks/engine/run.ts](src/mocks/engine/run.ts) /
  [src/mocks/engine/weights.ts](src/mocks/engine/weights.ts) — algorithm unchanged,
  `DEFAULT_WEIGHTS` unchanged, `ENGINE_VERSION` → `"v1.0.0"`.
- Close the two known prototype gaps (PRODUCT_PLAN §4.1): add the **missing-prerequisite**
  knockout and the **no open intake in the planning window** knockout.
- Knockouts expressed as a `findOptions()` WHERE where practical, then score in code
  ([NEST_SEARCH.MD](NEST_SEARCH.MD) Ch. 5 / 20).
- Endpoints: `POST /match/runs` `{ student_id, weights? }` (persist a `MatchRun`),
  `POST /match/preview` `{ student_id, weights }` (compute, no persist — powers the
  live weight-slider re-rank; the prototype already models this as `persist: false`),
  `GET /students/:id/match-runs/latest`, `GET /match-runs/:id`.

### G. Catalogue admin + importer
- CRUD for `university` / `course` / `course_intake` / `scholarship` (super_admin only),
  as four-file list endpoints.
- CSV bulk importer (CRICOS-style columns) with a dry-run + row-error report.
- Seed from [src/mocks/db/universities.ts](src/mocks/db/universities.ts) +
  [src/mocks/db/courses.ts](src/mocks/db/courses.ts) filtered to `country === "AU"`
  (8 universities, ~35 courses). `cricos` required for AU courses.

### H. Documents + follow-ups
- Replace the prototype's inline data-URL attachments with S3-compatible object storage
  (MinIO locally): presigned upload, store a file ref. Endpoints mirror the prototype's
  `documents` / `follow-ups` resources.

### I. Wire the React app off MSW
- [src/@common/options.tsx](src/@common/options.tsx): `BASE_URL` from `VITE_SERVER_URL`
  (drop the hard-coded `https://api.edu-visa.local`).
- [src/index.tsx](src/index.tsx): call `enableMocking()` only when `VITE_USE_MOCKS === "true"`.
- [src/authProvider.ts](src/authProvider.ts) / [src/accessControlProvider.ts](src/accessControlProvider.ts):
  real JWT `login`/`check`/`logout`/`getIdentity`/`getPermissions`; real `can()` hitting
  the backend (or decoding role claims). The role switch in `MainLayout` becomes a
  dev-only affordance.
- [src/_service/dataProvider.ts](src/_service/dataProvider.ts): remove the `console.log`;
  the token/refresh path in [src/_service/axious.ts](src/_service/axious.ts) is already
  written for a real API.
- [src/modules/@match/result.tsx](src/modules/@match/result.tsx),
  [src/modules/@student/list.tsx](src/modules/@student/list.tsx),
  [src/modules/@student/show/show.tsx](src/modules/@student/show/show.tsx): the direct
  `deriveProfile` / `runMatch` calls become API calls (`GET /students/:id/profile`,
  `POST /match/preview`, `POST /match/runs`). The list's per-row live GPA/English/
  affordability columns read `student_profile` from the list payload (embed it server-side).
- Backend search DTOs must accept exactly the suffix filters
  `@refinedev/simple-rest`'s `generateFilter` emits (`_gte _lte _gt _lt _like _ne _in _nin`,
  plain `eq`, dotted `university.country`) — see the prototype's
  [src/mocks/handlers.ts](src/mocks/handlers.ts) for the authoritative list. Enforce the
  [NEST_SEARCH.MD](NEST_SEARCH.MD) Appendix A checklist in review (every id/FK/enum/bool/date
  filter needs `{ operation: 'eq', operator: 'and' }`; `_end` is an absolute row index;
  `between` needs ≥2 values; fresh array literal into `findOne`).

### J. Chat seam — scaffold only
- `assistant` module: `conversation` + `message` entities, `POST /assistant/messages`
  returning a **stubbed** reply, `conversation_id` nullable FK on `match_run`.
- No LLM, no RAG, no web search wired. This is the attachment point for the next phase
  (agent loop + tools: `run_intake`, `run_match`, `search_web`, `lookup_visa_rule`).

### Explicitly deferred to the following phase(s)
RAG corpus + `pgvector` + ingestion pipeline; OpenRouter integration; live web-search
tool; the conversational agent loop and its tools; counsellor review/edit of the AI
report; the golden-profile eval harness in CI; analytics dashboards; NZ / UK / CA.

---

## Critical files

**New — `server/`:** `src/common/{dto,services,auth}`,
`src/modules/{student, academic-record, language-test, work-experience, career-goal,
finance, sponsor, visa-history, dependant, preferences, university, course, course-intake,
scholarship, reference, profile, match, document, follow-up, assistant}`,
`src/migrations/*`, `src/seed/*`, `docker-compose.yml`, `server/.env`.

**Logic to port (unchanged algorithm):**
[src/mocks/engine/derive.ts](src/mocks/engine/derive.ts),
[src/mocks/engine/score.ts](src/mocks/engine/score.ts),
[src/mocks/engine/run.ts](src/mocks/engine/run.ts),
[src/mocks/engine/weights.ts](src/mocks/engine/weights.ts),
[src/mocks/db/reference.ts](src/mocks/db/reference.ts).

**Contract source of truth:** [src/mocks/types.ts](src/mocks/types.ts) — backend entities +
shared DTOs derive from it; `MatchResult` stays byte-identical.

**Frontend edits:** [src/@common/options.tsx](src/@common/options.tsx),
[src/index.tsx](src/index.tsx), [src/authProvider.ts](src/authProvider.ts),
[src/accessControlProvider.ts](src/accessControlProvider.ts),
[src/_service/dataProvider.ts](src/_service/dataProvider.ts),
[src/modules/@match/result.tsx](src/modules/@match/result.tsx),
[src/modules/@student/list.tsx](src/modules/@student/list.tsx),
[src/modules/@student/show/show.tsx](src/modules/@student/show/show.tsx).

**Seed inputs (filter to AU):** [src/mocks/db/universities.ts](src/mocks/db/universities.ts),
[src/mocks/db/courses.ts](src/mocks/db/courses.ts),
[src/mocks/db/students.ts](src/mocks/db/students.ts).

**Reference:** [NEST_SEARCH.MD](NEST_SEARCH.MD) (four-file pattern, Appendix A foot-guns),
[docs/PRODUCT_PLAN.md](docs/PRODUCT_PLAN.md) §3–§5, §8.

---

## Verification (end-to-end)

1. **Stand up:** `cd server && docker compose up -d` (pg/redis/minio) →
   `npm run migration:run` → `npm run seed` (8 AU universities, ~35 courses, reference
   tables, 1 super_admin + 1 counsellor + the 6 named student fixtures) →
   `npm run start:dev` (`:3000`).
2. **Frontend against real API:** `VITE_SERVER_URL=http://localhost:3000 npm run dev`
   (root). Confirm no MSW worker registers.
3. **Golden port test (backend Jest):** for each of the 6 named student fixtures, assert
   the ported `deriveProfile` and `score` outputs equal the current
   [src/mocks/engine/](src/mocks/engine/) outputs (snapshot committed from the prototype).
   This gates the port.
4. **Walk the prototype flows against the API:**
   - Intake create → `student_profile` row written with `version = 1` (check DB); editing
     any Side A record bumps `version` and recomputes.
   - `/students/:id/matches` → a `match_run` row persists with `profile_version`,
     `engine_version`, `weights`, `results`; reload shows the saved run.
   - Weight sliders re-rank live via `POST /match/preview` with no new `match_run` row.
   - Catalogue filters (country / level / field-contains / max-tuition) return correct
     rows; only AU courses exist.
   - Document upload lands in MinIO; the profile view renders it from a presigned URL.
   - Switching role to one without the visa permission hides/403s the Visa-history tab;
     audit-log rows appear for financial/visa reads.
5. **Search-contract parity:** hit `GET /courses?degree_level_in=Master&tuition_fee_lte=45000&university.country=AU&_sort=world_rank&_order=ASC&_start=0&_end=25`
   and confirm the `{ elements, totalElements, pageable }` envelope and correct rows.
6. **Typecheck both sides:** `npm run typecheck` (root) and `cd server && npm run build`.

---

# Appendix — How the AI consultant serves a solution

> This appendix is **design for the phase *after* this one**. Nothing here is built in the
> phase above — the phase above only stands up the `assistant` module stub (§J) as the
> attachment point. It is included so the direction is concrete and the seams built now
> are the right ones.

## A. The knowledge base — three tiers, three jobs

| Tier | Store | Shape | Job | Refresh |
|---|---|---|---|---|
| **1. Catalogue** (curated) | Postgres tables `course` / `university` / `course_intake` / `entry_requirement` / `scholarship` | Structured, validated | **Deterministic matching** (engine §F) — knockouts + scores. The *only* tier the ranking depends on. | Admin CRUD + CSV importer; quarterly re-verify; per-row staleness flag |
| **2. RAG corpus** | Postgres + `pgvector` — `doc`, `doc_chunk` | Chunked text + embedding + metadata | **Grounding the narrative** — entry-requirement nuance, scholarship terms, cost-of-living, culture, and current **AU student-visa rules** (financial capacity, genuine-student criteria, work rights, post-study / PR pathways) | Scheduled crawl/import → re-embed; `effective_date` drives freshness; past-`review_by` sources flagged in the report |
| **3. Live web** | none — fetched per query, cached briefly | Raw page → transient chunks | **Freshness fallback** when the corpus has no chunk newer than a threshold, or the question is about a just-changed fee/policy | per query; hits are labelled *live, unverified* and queued for corpus ingestion |

**Is RAG the knowledge base?** Yes — Tier 2 (`pgvector`) is the knowledge base for
everything the AI *says*. It is deliberately **not** what the ranking depends on: the
engine runs only on the human-verified Tier 1 catalogue. RAG grounds the narrative and is
always cited; it never scores or re-orders.

**Corpus sources (Australia release) and how much to trust each:**

| Source | Used for | Reliability / update cadence |
|---|---|---|
| Dept. of Home Affairs (`immi.gov.au`), Study Australia (`studyaustralia.gov.au`) | Subclass 500 / 485 rules, funds figure, Genuine Student criteria, work-hour limits, PR pathways | **Authoritative** — single source of truth for visa rules. Changes a few times/year; pin `effective_date`, re-crawl on a cadence, watch for update notices. |
| CRICOS registry (`cricos.education.gov.au`), TEQSA / ASQA | Legally registered providers & courses, CRICOS codes | **Authoritative** official registry. Used to validate Tier 1 rows. |
| University `.edu.au` course / fee / scholarship / entry pages | Catalogue verification, entry-requirement nuance, scholarship terms | **Reliable per intake cycle.** Fees are published annually and *indicative*; scholarship terms change yearly. Re-verify each cycle; flag rows older than one cycle. |
| QS / THE rankings | `world_rank` | Stable within a year; published annually. |
| Numbeo / Expatistan / state-government cost-of-living pages | Living-cost ranges per city | **Approximate only** — crowd-sourced, lags, methodology varies. Stored as ranges with `as_of`, cross-checked against ≥2 sources, never surfaced as a precise figure. |
| Aggregators (IDP, StudyPortals, hotcourses, …) | Discovery of courses to then verify | **Not trusted as source of truth** — commercial incentives, stale data. Leads only; every fact re-checked against a `.edu.au` or government page before it enters Tier 1 or is cited. |
| Institution policy pages (credit transfer, English waivers, progression) | Narrative nuance | Reliable; low change rate. |
| Internal counsellor playbooks + anonymised past-case notes with outcomes | Narrative nuance, mitigations, realistic expectations | Highest-value, lowest-volume; owned by the business, curated. |

**Are the online sources accurately updated?** Visa rules and CRICOS — yes, and every
chunk is date-stamped with staleness flagged in the report. University fees / scholarships
— current for the upcoming intake but indicative and annual, so re-verified per cycle.
Cost-of-living — inherently fuzzy, hence ranges, not point values. The trust model that
closes the gap: **cite every claim, carry an `effective_date` on every claim, counsellor
reviews the report before the student sees it, standing "advice, not a guarantee"
disclaimer, and `web_search` results always labelled *live, unverified*.** Crawling
respects each site's ToS / `robots.txt`; government and `.edu.au` content is used under
fair-dealing for the consultancy's own advisory use.

**Ingestion pipeline** (BullMQ on a schedule):
```
source (crawl | upload | connector)
  → fetch + dedupe by content hash
  → clean (boilerplate strip, PDF→text, table flatten)
  → segment (~500–800 tokens, ~15% overlap, respect headings)
  → enrich metadata { country:"AU", institution?, course_level?, doc_type,
                      source_url, publisher, effective_date, review_by, jurisdiction }
  → embed (embeddings model via OpenRouter or a dedicated provider)
  → upsert doc_chunk (vector + tsvector for hybrid search)
  → deactivate superseded chunks (same source_url, older effective_date)
```
**Metadata is the retrieval lever:** every retrieval pre-filters by metadata *before*
vector search (`country=AU`, then `institution` / `course_level` / `doc_type`), so a NZ
rule or an MBA requirement never leaks into a Bachelor-of-IT answer.

## B. The agent loop (the complex part)

The deterministic engine **owns the ranking**. The AI layer is an **orchestrator around
it** — it fills the intake by conversation, triggers the engine, explains and
pressure-tests the output with grounded retrieval, and answers open questions. It never
scores or re-orders.

```
                 ┌─────────────────────────────────────────────┐
   user msg ───▶ │  Orchestrator (LLM, strong model)           │
                 │  system prompt + conversation + PII-min      │
                 │  profile summary + tool definitions          │
                 └───────┬─────────────────────────────────────┘
                         │ picks a tool (or answers directly)
     ┌───────────────────┼─────────────────────────┬──────────────┐
     ▼                   ▼                         ▼              ▼
 update_intake      run_match / run_preview    retrieve_kb     web_search
 (writes Side A,    (deterministic engine       (metadata-      (freshness
  bumps profile      API → MatchRun JSON)        filtered        fallback,
  version)                                       hybrid RAG)     cited "live")
     └───────────────────┴────────────┬────────────┴──────────────┘
                         ▼
             tool results appended to context; loop until enough
                         ▼
             compose_answer → strict JSON → zod validate
                         │  invalid → retry (max 2) → else deterministic template
                         ▼
             citation check: every concern / rule / requirement claim needs a
             non-empty cites[] → un-cited claims dropped
                         ▼
             stream to counsellor UI → counsellor edits → student sees it
```

| Tool | Does | Guardrail |
|---|---|---|
| `update_intake(section, data)` | Writes a Side A record, triggers profile re-derivation | Consent on file; validated against the field dictionary |
| `run_preview(weights?)` | Engine, **no persist** — "what if" | — |
| `run_match(weights?)` | Engine, **persists a MatchRun** | Needs a minimum-complete profile (GPA + English-or-"no test" + budget + destination + field) |
| `retrieve_kb(query, filters, pass)` | Hybrid search over `doc_chunk`, metadata pre-filtered; `pass ∈ {entry_req, visa_financial, scholarship, career_pr, cost_of_living}` | Returns chunk text + `{id, source_url, effective_date}`; retrieved text treated as **data, not instructions** |
| `web_search(query)` | Live fetch, only when corpus coverage is stale/empty | Labelled `live, unverified`; never silently overrides a corpus rule |
| `get_visa_history(student_id)` | Reads the visa-history table | Separate permission; feeds only the **advisory** section, never the match % |

**Retrieval, in detail** — for a `(profile, course)` pair the orchestrator runs
**separate** `retrieve_kb` passes, one concern each (blending them kills recall):
1. Query built from **structured fields, not chat text** — e.g.
   `"AU subclass 500 financial capacity 2026 single applicant tuition 45000 living 12 months"`,
   not *"can she afford it"*.
2. Metadata pre-filter (`country=AU`, `doc_type=visa_guidance`, `effective_date >= now-18mo`).
3. Hybrid search: vector ∪ keyword (`tsvector`), top-k ≈ 20.
4. Rerank with a cheap model → top ≈ 5.
5. Freshness gate: newest surviving chunk older than the pass threshold → fire
   `web_search`, merge, label.

**What `compose_answer` is / isn't given:** the deterministic `MatchRun` **verbatim**; a
**PII-minimised** profile (affordability *band* not balances, *age* not DOB, no passport
number, city-level location); the retrieved chunks tagged with `id` + `effective_date`;
the conversation. Output is strict JSON (`why[]`, `concerns[]`, `missing_info[]`,
`documents_required[]`, `scholarship_opportunities[]`, `alternatives[]`,
`visa_considerations{advisory:true, notes[]}`, `confidence`) — every `concerns` / visa /
requirement item carries `cites: [chunk-id]`; un-citable claims are stripped before
storage; the "advice, not a guarantee" disclaimer is injected.

## C. Worked examples

**1 — "I don't know which country. Bachelor in Business, GPA ~3.2/4, family income NPR
24L/yr, savings NPR 35L, maybe a 50L education loan."** *(pre-intake, exploratory)*
- Orchestrator sees no profile → `update_intake` for the volunteered academic + finance
  fields → derivation runs via the FX + concordance reference tables → `canonical_gpa ≈ 76`,
  `available_funds_aud`, `affordability_score`.
- No match yet (destination unknown). `retrieve_kb` passes: `cost_of_living` (AU cities)
  and `visa_financial` (subclass 500 funds figure).
- `compose_answer`: "Affordability band *moderate* → a AUD ~35–45k/yr tuition ceiling is
  realistic in Australia. GPA maps to ~76/100 canonical, clearing entry for most Master of
  Business/Data Analytics courses. The 500 visa currently expects ~AUD X in demonstrable
  funds for a single applicant [chunk-id, eff. 2026-…]. Next: English section + confirmed
  budget, then I can rank courses." → `missing_info: ["English test / 'no test yet'",
  "confirmed annual budget", "career goal detail"]`.

**2 — "Run my match" → "Why is Deakin above my preferred UNSW?"** *(explain the
deterministic result)*
- `run_match` → engine ranks Deakin course #1, UNSW course #4.
- Orchestrator reads the two `MatchResult` rows — **no retrieval for the arithmetic**:
  "UNSW needs canonical GPA ~82; yours is 76 → `academic` 41 plus a soft `alignment`
  penalty. Deakin needs ~70 → `academic` 79, and tuition AUD 38k vs 49k lifts `financial`
  52 → 88. Weighted: Deakin 84 vs UNSW 63."
- One `retrieve_kb(entry_req)` pass to cite the UNSW GPA line it quotes. Moving the
  `location`/`ranking` sliders calls `run_preview` and the explanation regenerates live.

**3 — "Can I actually get the visa? I was refused a UK student visa in 2023."** *(visa-risk
advisory — kept separate from the match %)*
- `get_visa_history` (permission-gated) → one `refused` UK record, reason "insufficient
  funds evidence".
- `retrieve_kb(visa_financial)` + `retrieve_kb(career_pr)` on AU subclass 500 guidance;
  `web_search` fires if the newest funds-rule chunk is >12 months old.
- `compose_answer` writes **only** into `visa_considerations`: "A prior refusal is
  disclosable and raises genuine-student scrutiny [chunk-id]. Current funds threshold AUD X
  [chunk-id, eff. …]; your evidenced liquid funds are *below/at/above* band. Mitigations: …
  Documents: refusal letter, 3-month-seasoned statements, sponsor affidavit." `confidence`
  lowered; counsellor must review before the student sees it.

**4 — "Is the Deakin scholarship something I'd get?"**
- Orchestrator has `MatchResult.scholarship_opportunities` + `scholarship_potential:
  "medium"` from the run.
- `retrieve_kb(scholarship)` filtered to `institution=Deakin`, `doc_type=scholarship_terms`
  → current %, GPA cut-off, deadline, separate-application flag.
- Answer reconciles the engine's eligibility flag with the retrieved terms, cites them,
  pushes the deadline into `documents_required` / `missing_info`.

## D. Failure modes handled explicitly
- **Invalid JSON** → 2 retries with the validation error, then fall back to the
  deterministic templated report the prototype already renders.
- **Uncited rule/requirement claim** → dropped, `missing_info` note added.
- **Stale-only corpus** → `web_search`, result labelled live-unverified, ingestion queued.
- **Profile too thin for `run_match`** → tool refuses, returns the missing fields.
- **Prompt injection in a crawled page** → retrieved content quoted as data; a guard pass
  strips instruction-like spans; a chunk can never mutate the system prompt.
- **Every report is a snapshot** — stored with `profile_version`, `engine_version`, model
  id, token/cost, and the cited chunk ids, so it stays reproducible after the catalogue or
  the student's file changes.
