# Edu-Visa — Product Plan

**AI Student ↔ University / Course Matching Portal for an education & migration business.**

Status: draft · Owner: _TBD_ · Last revised: 2026-08-30

This document is the bridge between the current `README.MD` (a consultant brief) and a
buildable system. It reviews that brief, defines the domain model and the matching
engine, and specifies the production architecture — NestJS backend, deterministic
matching, and the AI + RAG layer that produces the final recommendation report.

`README.MD` is kept as-is; §2 below is its review.

---

## Table of contents

0. [The prototype in this repo](#0-the-prototype-in-this-repo)
1. [Overview & goals](#1-overview--goals)
2. [Requirements review of the current README](#2-requirements-review-of-the-current-readme)
3. [Domain model](#3-domain-model)
4. [Deterministic matching engine](#4-deterministic-matching-engine)
5. [Backend architecture (NestJS)](#5-backend-architecture-nestjs)
6. [AI + RAG report layer](#6-ai--rag-report-layer)
7. [End-to-end flow](#7-end-to-end-flow)
8. [Non-functional requirements](#8-non-functional-requirements)
9. [API surface](#9-api-surface)
10. [Delivery roadmap](#10-delivery-roadmap)
11. [Open decisions](#11-open-decisions)

---

## 0. The prototype in this repo

A **React prototype** lives at the repo root. It is filled with **dummy data** and has
**no backend** — it exists to make the flow tangible and to lock down the `MatchResult`
contract (§4) before backend work starts.

| Aspect | Prototype | Production (this plan) |
|---|---|---|
| Data | `src/mocks/db/*.ts` fixtures (~14 universities, ~63 courses, ~15 students) | PostgreSQL via TypeORM |
| Transport | **MSW** intercepts the real axios traffic; `src/mocks/handlers.ts` emulates the `@sksharma72000/nestjs-search-page` list/filter/paging semantics and returns `{ elements, totalElements, pageable }` | NestJS REST, same envelope |
| Matching | `src/mocks/engine/*` — `deriveProfile` → `knockout` → `score` → `runMatch`, runs in the browser | NestJS `match` module, same algorithm & output type |
| "AI report" | deterministic templated sentences built from the structured result, clearly labelled a stand-in | OpenRouter + RAG service (§6), same `MatchResult` shape |
| Auth | stub (`authProvider.ts`) — always signed in, role switch in the top bar | JWT + RBAC (§8) |

**Run it**

```bash
npm install
npm run dev          # http://localhost:5173
```

**Screens** (`src/modules/`)

- `@student/list` — students grid with search / stage / target-country filters, monogram
  avatars, and GPA / English / affordability columns computed live by `deriveProfile`.
  Row click → profile.
- `@student/show` — **student profile view**, modelled on `skool-mui`
  `@student/info/show.tsx`: a left rail (identity card with an **inline-editable stage
  chip**, match snapshot, personal & preference cards) and a tabbed right pane (Academic
  / English / Work / Career / Financial / Sponsors / Dependants / Visa history /
  **Documents** / **Follow-ups**). Documents and Follow-ups are add/delete CRUD (modal
  form, file attachments inlined as data URLs in the prototype).
- `@student/intake` — 10-section multi-step intake form (`useFieldArray` for academic
  records, jobs, income sources, sponsors, visa history). Submitting derives a profile
  and jumps to the match screen.
- `@catalog` — course catalogue with country / level / field / tuition-ceiling filters;
  a row opens a course detail dialog (entry requirements, scholarships, outcomes).
- `@match` — ranked recommendation cards with per-dimension score bars and the
  _why / concerns / missing info / documents / scholarships / alternatives_ panels;
  dimension-weight sliders re-rank live.

Every page carries an `AppBreadcrumbs` trail (`@components/breadcrumb/app.breadcrumb.tsx`).

**Reused from `skool-mui`** (verbatim, with path aliases): `@components/*` (view
wrappers, `TableGrid`, `CSInput`, modals, filters-result, labels), `@hooks/*`
(`useRefineDataGrid`, `useRefineForm`, …), `@utils`, `@common`, `theme/*`, and
`_service/dataProvider.ts` — whose `_start/_end/_sort/_order` ⇄ `{ elements,
totalElements, pageable }` contract is exactly what the search package emits, so moving
to the real API is a `BASE_URL` change plus removing `enableMocking()` from
`src/index.tsx`.

---

## 1. Overview & goals

**Problem.** Course/university selection today is manual, biased toward the few
institutions a counsellor knows, and disconnected from the student's finances and
visa-risk profile. Students pick a university; nobody systematically checks whether it
is the _right_ one for their background, budget, English level and career goal.

**Product.** A profile-driven engine that scores every course in a maintained catalogue
against a structured student profile, returns a ranked shortlist with per-dimension
reasoning, and — in production — an AI-generated narrative report grounded in current
course, scholarship and visa guidance.

**Users / roles**

| Role | Does |
|---|---|
| **Student** | Completes / reviews their intake; reads the final report. |
| **Counsellor** | Owns a caseload; completes intake on the student's behalf; runs matches; reviews and edits the AI report before it reaches the student. |
| **Branch admin** | Manages counsellors and the branch caseload; sees branch analytics. |
| **Super admin** | Manages the course/university/scholarship catalogue, reference tables, engine weights, users across branches. |

**Success metrics** (instrument from day one)

- Shortlist → application conversion rate.
- Counsellor time from intake complete → shortlist delivered.
- % of recommended courses that result in an offer.
- Visa-grant rate for applications routed through the tool vs. baseline.
- Counsellor edit rate on the AI report (proxy for report quality).

---

## 2. Requirements review of the current README

### Keep — the brief gets these right

- **Two-sided database.** Student side and University/Course side as peers joined by a
  matching engine is the correct spine.
- **Purpose-driven intake.** "Every field has a job in the matching engine" is the right
  scoping filter. The 10 sections are sound.
- **Derived profile, not raw answers.** Converting responses into structured variables
  (canonical GPA, total relevant experience, affordability score) before matching.
- **Visa risk kept separate** from the academic match score — must remain a written rule.
- **Data structure before AI.** Rules-based matching first; the LLM narrates a result
  that already stands on its own.
- **Output shape.** "Rank / University / Course / Match % / Why", plus per-dimension
  sub-scores and _why / concerns / missing info / documents / scholarships /
  alternatives_ — adopted verbatim as the `MatchResult` contract (§4).

### Close — gaps that block a clean build

1. **Roles, tenancy, ownership.** Decide: student self-serve, counsellor-entered, or
   both (default: both, counsellor-led). Add `branch_id` to every core row from day one
   if the business is multi-office — retrofitting is expensive.
2. **PII & consent.** Passport number, all income/asset/liability figures, sponsor
   financials and the entire visa-history table are sensitive. Needs: encryption at
   rest, an audit log of who read/changed financial & visa data, explicit consent
   capture (timestamped, versioned), a retention policy, and a separate permission gate
   on visa-history reads.
3. **The matching engine, specified.** The README describes the _output_ but never the
   _rules_. §4 fills this: hard knockouts, per-dimension formulas, configurable weights,
   explainability schema.
4. **Normalization tables.** GPA scales (4.0 / 10.0 / % / division) → one canonical
   scale; IELTS / PTE / TOEFL / Duolingo → a concordance band; NPR / AUD / GBP / CAD FX
   → one comparison currency with an `as_of` date. Intakes & deadlines are
   time-sensitive — "next open intake" logic and stale-data flags.
5. **Side B sourcing.** No plan for where course data comes from or how it stays
   current. Needs admin CRUD + a bulk importer (CSV / CRICOS-style feed) and a
   re-crawl / re-verify cadence.
6. **Documents module.** The sample output lists "documents required", so there must be
   upload + per-course checklist tracking (transcripts, passport, funds evidence, SOP).
7. **Match-run persistence & versioning.** A recommendation is a _snapshot_ — fees and
   requirements drift. Persist each run with the profile version, engine version,
   parameters and results.
8. **Business reporting.** Pipeline by stage, counsellor throughput, conversion — name
   the metrics now even if built later (§1).
9. **Disclaimer.** The report is advice, not a guarantee of admission or visa grant —
   state it and surface it in the UI.

### Restructure — turn `README.MD` into a PRD with these sections

`0 Meta` · `1 Overview & goals` · `2 Personas & roles` · `3 Scope (MVP in/out)` ·
`4 Domain model` · `5 Field dictionary (appendix)` · `6 Matching engine` ·
`7 Non-functional` · `8 API surface` · `9 Roadmap` · `10 Open questions`.

### Field dictionary — the format the PRD appendix should use

The README promises "100–150 fields" but stops before delivering them. Each field is one
row:

| Field | Type | Req. | Enum / unit | Source |
|---|---|---|---|---|
| `full_name` | string | required | — | entered |
| `date_of_birth` | date | required | ISO date | entered |
| `nationality` | enum | required | ISO 3166 | entered |
| `passport_status` | enum | optional | none / applied / held | entered |
| `preferred_countries` | enum[] | required | AU / NZ / UK / CA / US | entered |
| `academic[].gpa_value` + `gpa_scale` | number + enum | required | 4.0 / 10.0 / % / division | entered |
| `language_tests[].test` + `overall` | enum + number | optional | IELTS / PTE / TOEFL / Duolingo | entered |
| `finance.income_sources[].amount` + `currency` | money | optional | `{amount, currency}` | entered |
| `annual_household_income` | money | — | comparison currency | **derived** (Σ sources) |
| `canonical_gpa` | number | — | 0–100 | **derived** |
| `english_band` | number | — | IELTS-equivalent | **derived** (concordance) |
| `available_funds` | money | — | comparison currency | **derived** |
| `affordability_score` | number | — | 0–100 | **derived** |

The prototype's `src/mocks/types.ts` is a working first cut of the full list.

---

## 3. Domain model

One aggregate per box. Side A hangs off `Student`; `StudentProfile` is computed and
versioned; `MatchRun` freezes a recommendation in time.

```
Side A — student                     Side B — catalogue
  Student (1)                          University (1)
   ├─ AcademicRecord (n)                ├─ Campus (n)
   ├─ LanguageTest (n)                  └─ Course (n)
   ├─ WorkExperience (n)                     ├─ CourseIntake (n)
   ├─ CareerGoal (1)                         ├─ EntryRequirement (1)
   ├─ FinancialProfile (1)                   └─ Scholarship (n)
   │    ├─ IncomeSource (n)
   │    ├─ Asset (n)
   │    └─ Liability (n)
   ├─ Sponsor (n)
   ├─ Dependant (n)   ─ relationship, DOB, accompanying?, passport
   ├─ VisaHistory (n)
   ├─ Preferences (1)
   ├─ Document (n)    ─ doc_type, remark, file, uploaded_by
   └─ FollowUp (n)    ─ counsellor activity log: kind, body, attachments, author
        │
        ▼  deriveProfile()  (recompute on any Side A change; bump version)
  StudentProfile  { version, canonical_gpa, english_band,
                    relevant_experience_months, available_funds,
                    affordability_score, pr_intent, ... }
        │
        ▼  matching engine (§4)
  MatchRun   { student_id, profile_version, engine_version, weights,
               created_by, created_at, results: MatchResult[] }
  MatchResult { course_id, overall, subscores{6}, why[], concerns[],
                missing_info[], documents_required[], scholarship_*,
                alternatives[], knockout, knockout_reasons[] }
```

**Design rules**

- `StudentProfile` and `MatchResult.subscores` are computed — keep them out of the
  intake write path.
- Every `MatchRun` stores the `profile_version` it ran against, so an old
  recommendation stays reproducible after the student updates their file.
- `VisaHistory` and any visa-risk score are a **separate section**, never blended into
  the match %.

---

## 4. Deterministic matching engine

The source of truth. The AI layer (§6) explains its output; it never scores or
re-ranks. The prototype implements this exact algorithm in `src/mocks/engine/`.

### 4.1 Knockouts (hard filters — course leaves the pool)

- Tuition/yr > student budget (small tolerance).
- Canonical GPA below the course entry minimum (small tolerance).
- English band below the course minimum (with a "no test yet" allowance).
- Prerequisite missing.
- Application deadline passed / no open intake in the planning window.

Each knockout is recorded with a human-readable reason.

### 4.2 Dimension scores (0–100 each)

| Dimension | Driven by |
|---|---|
| `academic` | GPA headroom over the entry minimum (diminishing returns); penalty if the course is below the student's target level. |
| `english` | Band margin over the requirement; "no test" → capped mid-score + a `missing_info` note. |
| `financial` | Available funds ÷ (tuition + living costs) for the course length. |
| `career` | Field alignment with the stated goal; degree-level match; relevant experience vs. the course's expectation; PR-pathway bonus for PR-intent students. |
| `location` | Preferred country / city / ranking / city-size fit. |
| `scholarship` | Eligibility for the course's scholarships given the canonical GPA; requirement satisfied vs. unmet. |

### 4.3 Overall

```
weighted   = Σ  subscore[d] · weight[d]          # weights configurable, normalised
alignment  = (level matches target ? 1 : 0.9) · (field related to goal ? 1 : 0.85)
overall    = knockout ? 0 : clamp(weighted · alignment)
```

The soft `alignment` gate keeps a cheap, easy course from topping the ranking on price
alone when it is off the student's target level or field.

Default weights (tunable per deployment): academic .24, english .16, financial .16,
career .26, location .08, scholarship .10.

### 4.4 `MatchResult` — the shared contract

```ts
interface MatchResult {
  course_id: string;
  university_id: string;
  overall: number;                                   // 0-100
  subscores: Record<
    "academic"|"english"|"financial"|"career"|"location"|"scholarship", number
  >;
  scholarship_potential: "none" | "low" | "medium" | "high";
  why: string[];
  concerns: string[];
  missing_info: string[];
  documents_required: string[];
  scholarship_opportunities: string[];
  alternatives: string[];
  knockout: boolean;
  knockout_reasons: string[];
}
```

This type is identical in `src/mocks/types.ts` and must stay identical in the NestJS
`match` module — it is the boundary the AI layer, the API and the UI all depend on.

---

## 5. Backend architecture (NestJS)

### 5.1 Stack

NestJS + TypeORM on **PostgreSQL** (chosen for `pgvector`, §6; this differs from
`skool-mui`'s MySQL — TypeORM patterns carry over unchanged). Redis for queues/cache.
Object storage (S3-compatible) for documents.

### 5.2 Module layout — one folder per aggregate

```
src/
  common/
    dto/page.dto.ts               # shared _start/_end/_sort/_order
    services/common.service.ts    # CommonService<T> wraps findAllByPage
    auth/                         # JWT guard, @AuthUser(), RBAC
  modules/
    student/  student-academic/  student-language/  student-work/
    student-finance/  student-visa/  student-preference/  document/
    university/  course/  course-intake/  scholarship/
    profile/                      # derives + versions StudentProfile
    match/                        # the engine — NOT a list endpoint
    report/                       # OpenRouter + RAG (§6)
    reference/                    # gpa-scale, english-concordance, fx-rate tables
    analytics/
```

### 5.3 Every list endpoint = the four-file pattern

Per `NEST_SEARCH.MD`. Search surface as decorators on the DTO; one-line service; typed
`Page<T>` response.

```ts
// modules/course/dto/search.dto.ts
export class CourseSearchDto {
  @IsOptional() @Type(() => Number)
  @PageSearch({ operation: 'eq', operator: 'and' })
  university_id: number;

  @IsOptional() @PageSearch()                       // LIKE %v%, OR — the search box
  title: string;

  @IsOptional()
  @PageSearch({ operation: 'in', operator: 'and' })
  degree_level: DegreeLevelEnum[];

  @IsOptional()
  @PageSearch({ operation: 'between', operator: 'and' })
  tuition_fee: number[];                            // ?tuition_fee=0&tuition_fee=45000

  @IsOptional()
  @PageSearch({ column: 'university.country', is_nested: true })
  country: string;

  @IsOptional()
  @PageSearch({ is_relational: true })
  university: boolean;
}
```

```ts
// modules/course/service.ts
getAll(page: PageDto, search: CourseSearchDto): Promise<Page<Course>> {
  return findAllByPage<Course>({ repo: this.repo, page, queryDto: search });
}
```

**Tenancy & role scoping** are forced in the controller from `@AuthUser`, never trusted
from the client:

```ts
search.branch_id = branchId;
if (role === Role.Counsellor) search.counsellor_id = userId;
```

### 5.4 The engine drops out of the model — by design

`NEST_SEARCH.MD` Ch. 5 / 20: use `findOptions()` for the `where`/paging, then take over.
The match engine is exactly this case — knockouts as a `findOptions()` WHERE, then score
in code:

```ts
const knockout = findOptions<Course>({ queryDto: {
  tuition_fee: [0, profile.available_funds],
  min_gpa_lte: profile.canonical_gpa,
  english_band_lte: profile.english_band,
}});
const pool = await this.courseRepo.find({
  ...knockout, relations: ['university', 'entryRequirement', 'scholarships'],
});
const results = pool.map(c => this.score(profile, c, weights))
                    .sort((a, b) => b.overall - a.overall)
                    .slice(0, limit);
await this.matchRunRepo.save({ student_id, profile_version: profile.version,
                               engine_version: ENGINE_VERSION, weights, results });
```

### 5.5 Search-package foot-guns → review checklist

From `NEST_SEARCH.MD` Appendix A. Enforce in code review:

- Default is `LIKE %v%` + `OR` — every id / FK / enum / boolean / date filter needs
  `{ operation: 'eq', operator: 'and' }`.
- `_end` is an **absolute row index**, not a page size (`take = _end − _start`).
- `between` silently no-ops with fewer than two values.
- Two `and` conditions on the **same column** deep-merge — last wins; use `between` or a
  single `raw` for a two-sided range.
- `@PageSelect` only works in a dedicated `selectDto`.
- `findOne` mutates the `customQuery` array you pass — hand it a fresh literal.
- `raw` = you own SQL-injection safety; only interpolate values you have coerced.
- Set `DEFAULT_PAGE_SIZE`, `DEFAULT_SORT_COLUMN`; keep
  `ValidationPipe({ whitelist: true, transform: true })` and `@Type()` on every
  non-string field.

---

## 6. AI + RAG report layer

**Principle.** The deterministic engine (§4) is the source of truth. The AI layer
**explains** and **surfaces grounded concerns** — it does not compute or re-order the
ranking. Every non-obvious claim in the report cites a retrieved source.

### 6.1 LLM gateway — OpenRouter API

One key, one bill, model routing:

- `OPENROUTER_API_KEY`, base `https://openrouter.ai/api/v1` (OpenAI-compatible).
- **Model routing per call type:** a strong model for the final report; a cheap, fast
  model for query expansion, retrieval reranking and section drafting.
- **Fallbacks:** an ordered `models` list so a provider outage degrades gracefully.
- **Provider routing prefs:** pin data-handling / region where required for PII.
- **Budgets:** per-report token + cost ceilings; hard-stop and alert on breach.
- Stream tokens to the counsellor UI while generating.
- Log the resolved model, token counts and cost on every `MatchRun` report.

### 6.2 RAG store

**PostgreSQL + `pgvector`** (swappable to Qdrant / Weaviate later — keep the retrieval
interface behind a port).

**Corpus**

- Course & university pages; entry-requirement documents; scholarship terms.
- Per-country **student-visa guidance**: financial-capacity rules, genuine-student /
  GTE-style criteria, work rights, post-study & PR pathways.
- Institution policies: credit transfer, English-test waivers, academic progression.
- Internal counsellor playbooks; anonymised past-case notes and outcomes.

**Chunk metadata** (drives filtered retrieval):
`{ country, institution, course_level, doc_type, source_url, effective_date }`.

### 6.3 Ingestion pipeline

Scheduled crawl / import → clean → chunk (~500–800 tokens, overlap) → embed (an
embeddings model via OpenRouter or a dedicated embeddings provider) → upsert into
`pgvector`. Re-index on a cadence; `effective_date` drives freshness; sources past their
review date are flagged and the report notes when guidance may be stale.

### 6.4 Retrieval

For each `(student_profile, shortlisted_course)`:

1. Build the query from the structured profile + course (not raw form text).
2. **Metadata-filter** to `country = <destination>`, `institution`, `course_level`.
3. Hybrid search (vector + keyword), top-k.
4. Optional LLM rerank (cheap model).
5. Separate retrieval passes for: entry-requirement confirmation, visa/financial risk,
   scholarship eligibility, career/PR outcomes.

### 6.5 Generation

Prompt =
`deterministic MatchRun result` +
`PII-minimised profile` (affordability **band**, not balances; no passport number; DOB →
age) +
`retrieved chunks with ids`.

Output = **strict JSON**, `zod`-validated, retried on invalid:

```jsonc
{
  "why": [{ "text": "...", "cites": ["chunk-id"] }],
  "concerns": [{ "text": "...", "cites": ["chunk-id"], "effective_date": "2026-03-01" }],
  "missing_info": ["..."],
  "documents_required": ["..."],
  "scholarship_opportunities": [{ "text": "...", "cites": ["chunk-id"] }],
  "alternatives": ["course-id"],
  "visa_considerations": { "advisory": true, "notes": [{ "text": "...", "cites": ["chunk-id"] }] },
  "confidence": 0.0
}
```

Rules: every `concerns` / `visa_considerations` / requirement claim must carry a
non-empty `cites`; un-citable claims are dropped before the report is stored.

### 6.6 Guardrails

- JSON-schema validation + bounded retries.
- **Citation enforcement** — drop claims without a source id + `effective_date`.
- "Advice, not a guarantee" disclaimer injected into every report.
- **Visa narrative is its own advisory section**, never folded into the match %.
- **Human-in-the-loop** — the counsellor reviews and edits before the student sees it;
  edits are captured as labelled feedback.
- **Prompt-injection defence** on retrieved / crawled content (treat as data, strip
  instructions, never let a chunk change the system prompt).
- **Eval set** of golden student profiles → expected shortlist + report assertions; run
  on every engine / weight / prompt / model change in CI.

### 6.7 Feedback loop

Counsellor accept / reject / edit signals, plus real admission and visa outcomes, feed
back to: tune dimension weights, refine retrieval filters, improve prompts. Stored as a
labelled dataset.

---

## 7. End-to-end flow

```
intake (student or counsellor)
  → profile derivation           (GPA / English concordance / FX normalization; version++)
  → knockouts + dimension scoring (deterministic engine, §4)
  → top-N shortlist
  → per-course RAG retrieval      (metadata-filtered, §6.4)
  → OpenRouter generation         (grounded, schema-checked, cited, §6.5)
  → counsellor review & edit      (human-in-the-loop)
  → final report to student       (portal + PDF)
  → outcome tracking              (offer / visa result)
  → feedback into weights / prompts / index
```

---

## 8. Non-functional requirements

- **RBAC** — `student`, `counsellor`, `branch_admin`, `super_admin`; branch scoping on
  every query; visa-history reads behind their own permission.
- **PII at rest** — column-level encryption for passport number, all financial figures,
  sponsor financials, and the visa-history table (TypeORM transformer or DB-native).
- **Audit log** — who viewed / changed a student's financial or visa records, when.
- **Consent** — captured at intake, timestamped and versioned; withdrawal supported.
- **Retention** — defined maximum age for inactive students' financial data; scheduled
  purge.
- **Rate limits** on public endpoints; **LLM cost controls** per report and per tenant.
- **Observability** — trace every report: retrieval query, chunk ids, model, tokens,
  cost, latency; dashboards for engine score distributions and report edit rates.
- **Evals in CI** — the golden-profile suite gates deploys that touch the engine or the
  report prompts.

---

## 9. API surface

Standard list/search (`_start/_end/_sort/_order` → `Page<T>`) for `students`,
`universities`, `courses`, `scholarships`, `documents`, `match-runs`.

Match & report:

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/match/runs` | `{ student_id, weights? }` → run the engine, persist a `MatchRun`. |
| `GET` | `/students/:id/match-runs/latest` | most recent run for a student. |
| `GET` | `/match-runs/:id` | a specific run with results. |
| `POST` | `/match-runs/:id/report` | trigger RAG + OpenRouter generation for the run. |
| `POST` | `/match-runs/:id/report:approve` | counsellor approves (optionally with edits) → student-visible. |

---

## 10. Delivery roadmap

| Phase | Scope |
|---|---|
| **P0 — foundation** | Schema for Side A + Side B; auth + RBAC + branch tenancy; audit log. Admin CRUD for University / Course / CourseIntake / Scholarship + CSV importer. Intake form (all 10 sections) → stored student file; list + search over students and courses. **No scoring yet.** |
| **P1 — the engine** | Reference tables (GPA scales, English concordance, FX). `StudentProfile` derivation + versioning. Deterministic matching: knockouts + weighted dimension scores + `MatchRun` persistence. Result screen with score bars and the explanation panels. |
| **P2 — depth** | Documents module + per-course checklist. Scholarship matching & "scholarship potential". Visa-risk advisory model — separate score, separate permission, never blended in. Counsellor dashboard (pipeline, students missing info, recent runs). |
| **P3 — the AI layer** | RAG corpus + ingestion pipeline + `pgvector`. Retrieval service. OpenRouter report generation with schema validation, citation enforcement, guardrails. Eval harness in CI. Counsellor review/edit UI + feedback capture. |
| **P4 — analytics** | Conversion & pipeline reporting; visa-grant tracking; weight/prompt tuning from the feedback loop. |

The prototype covers a slice of **P0–P1** in the browser to de-risk the model and the
UX; production rebuilds it on the stack above.

---

## 11. Open decisions

1. **Intake ownership for MVP** — student self-serve, counsellor-entered, or both?
2. **First destination country** — Australia only, or multi-country from the start?
   (Affects reference tables and CRICOS-style registration fields.)
3. **Side B data source for launch** — manual entry, a partner feed, or a scrape?
4. **Multi-branch from day one?** (If yes, `branch_id` everywhere now.)
5. **Service-fee payments in scope?** (Needs a payments integration if so.)
6. **Data-residency / retention obligations** in the operating jurisdiction for
   financial and visa data.
7. **Embeddings provider** — via OpenRouter or a dedicated one; dimension & cost.
8. **OpenRouter model choices** — which model for the final report vs. the cheap
   utility calls; fallback order.
