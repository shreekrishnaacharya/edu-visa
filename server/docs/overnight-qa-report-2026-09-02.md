# Overnight QA report — 2026-09-02

Run against the live docker stack you started (`server-db-1`, `server-redis-1`,
`server-minio-1`), still up. Server running at `http://localhost:3000`
(`node dist/main.js`, PID logged in `/tmp/api.log`).

## TL;DR

- **36/36 endpoint integration tests pass** (real MinIO upload/download included).
- **Real knowledge base ingested**: 12 documents / 30 chunks from official
  Australian government + university sources, embedded via OpenRouter and
  stored in pgvector.
- **AI agent is live**: OpenRouter + `google/gemma-4-26b-a4b-it`, grounded in
  the real KB, citing sources, correctly separating visa-risk from match
  score. Tested on 41 real questions across the 100-profile batch — **0
  failures, 1 degraded** (see below).
- **100 synthetic student records created, intake→profile→match run for all
  100 (0 errors)**; 41 of them also asked real AI questions.
- **OpenRouter spend: ~$0.01** (of $5 limit, $1.66 remaining) — the free tier
  turned out to be rate-limited under real load, so I switched to the paid
  model; it's cheap enough that this was the right call, not a budget risk.
- **1 real config fact worth knowing**: the API key you gave me has a **hard
  $5 lifetime limit and only ~$1.67 remained** when I started (~$3.33 already
  used by something before this session). Nothing here needed it, but if you
  planned a much bigger run, budget for a bigger key.

Everything below is reproducible — scripts are committed under `server/scripts/`.

---

## 1. Endpoint integration testing

`node scripts/integration-test.mjs` — 36 checks against every route: auth
(login/refresh/401), students (list/filter/tenancy/create/patch/profile
embed), visa-history gating + audit, catalogue (universities/courses/filters/
CRUD/RBAC/CSV import dry-run), match (`run` persists, `preview` doesn't,
`latest`, `by id`), profile versioning on edit, follow-ups CRUD, **documents —
real MinIO upload, presigned-URL download, content round-trip verified byte-
for-byte, delete purges storage**, reference fx-rates, assistant stub→real
pipeline. Full machine-readable result: `/tmp/integration-report.json`.

Two failures on a mid-batch run turned out to be **stale test assertions**,
not product bugs — the QA batch's synthetic names collided with the seed
fixture's name/count assumptions (a "Deepak…" QA student outranked the seeded
"Deepak Adhikari" in an unfiltered name search; the hardcoded "exactly 15
students" check broke once the batch added more). Fixed the test script to
filter on the seed's unique `state=Applied` and assert `>= 15`. Re-ran clean.
**This is a lesson for you, not just me: any assertion "student count == N" or
a bare name search is fragile once test data and real/demo data share a
database — scope test fixtures by a distinguishing field (I used
`branch = "QA Batch …"`) from the start next time.**

## 2. Knowledge base — real data, real sources

Government-egress and OpenRouter were both reachable this session (unlike
earlier in the week), so I ingested real content rather than placeholders.

**Pipeline**: `server/src/modules/knowledge/` — `Doc`/`DocChunk` entities
(pgvector `vector(1536)`, hand-written migration since TypeORM has no native
vector type), `IngestionService` (fetch → cheerio-clean → chunk → embed via
OpenRouter `text-embedding-3-small` → upsert, idempotent), `RetrievalService`
(hybrid: pgvector cosine ∪ Postgres `tsvector` keyword, metadata-filtered by
country/doc_type/institution), `WebFetchService` (allowlisted-domain fetch —
`.gov.au`/`.edu.au` only — as the live-freshness fallback, not open search: no
search-engine API key exists, and an unattended agent shouldn't wander off
official sources).

**Corpus** (`scripts/ingest-corpus.mjs`, 13 URLs attempted, 12 succeeded):

| Source | Doc type | Chunks |
|---|---|---|
| studyaustralia.gov.au — visa application process | visa_guidance | 3 |
| studyaustralia.gov.au — your guide to visas | visa_guidance | 1 |
| studyaustralia.gov.au — living and education costs | cost_of_living | 1 |
| studyaustralia.gov.au — how to apply to study | entry_requirement | 3 |
| studyaustralia.gov.au — scholarships | scholarship_terms | 2 |
| studyaustralia.gov.au — work rights and responsibilities | visa_guidance | 1 |
| studyaustralia.gov.au — work after graduating | visa_guidance | 1 |
| studyaustralia.gov.au — English courses | entry_requirement | 2 |
| costofliving.studyaustralia.gov.au | cost_of_living | 4 |
| RMIT — international students | institution_policy | 5 |
| University of Sydney — international students | institution_policy | 5 |
| University of Queensland — international students | institution_policy | 2 |
| ~~cricos.education.gov.au~~ | — | **failed**: JS-rendered, too little static text to extract |

**What I deliberately did NOT do**: `immi.homeaffairs.gov.au` (the actual
Dept. of Home Affairs) blocks non-browser User-Agents at the Akamai edge —
even its own `robots.txt` 403s. I did not spoof a browser UA to get past
that; I logged it as blocked and used `studyaustralia.gov.au` instead, which
is the same government's own study-visa-facing site with equivalent content
and an explicit `Disallow:` (i.e. fully open) `robots.txt`. Same treatment for
`unimelb.edu.au`, `deakin.edu.au`, `monash.edu`, `unsw.edu.au`, `uwa.edu.au` —
all either 403/404'd; not bypassed, just skipped and logged. **If you want the
primary Home Affairs pages specifically, that needs either a partnership/API
arrangement with Home Affairs or a licensed data feed — not something an
automated fetch should route around.**

**Retrieval quality** — spot-checked live: a financial-capacity query
correctly surfaced the real current AUD figure with source + chunk-level
citations, ranked sensibly by cosine similarity.

Admin endpoints: `POST /knowledge/ingest` (super_admin), `GET
/knowledge/stats`, `POST /knowledge/search`.

## 3. AI agent — OpenRouter + Gemma, wired for real

`assistant` module's stub reply is replaced by `OrchestratorService`
(`server/src/modules/assistant/orchestrator.service.ts`). Design choice worth
flagging: **not** a model-driven tool-calling loop. `gemma-4-26b-a4b-it` is a
small model and I didn't want to bet grounding/citation correctness on its
tool-call reliability, so my Node code decides which retrieval "passes" a
question needs (visa / cost-of-living / scholarship / entry-requirement —
mirrors the plan appendix's "one pass per concern"), assembles the grounded
context itself, and makes one generation call to compose the cited answer.
The deterministic matching engine is never touched by this — it only narrates
`MatchRun` results that already exist.

**Model**: tried `:free` first — hit OpenRouter's shared rate-limit pool
(429) almost immediately under real traffic. Switched default to the paid
`google/gemma-4-26b-a4b-it` (~$0.0002/call at this prompt size) with `:free`
as a fallback if the paid call also fails, and a budget guard that hard-stops
all calls if the key's remaining balance drops under $0.50 (checked against
`/auth/key`, cached 60s). This is not a config toggle right now, it's a
call-time model-list in `OpenRouterService`; a real budget/model policy
belongs in `.env` before this goes further — flagging that as a to-do, not
doing it silently.

**PII discipline** (plan appendix B.3, honoured): the prompt gets an
affordability *band* (strong/moderate/tight), *age* (not DOB), canonical GPA,
English band + source, PR intent — never raw account balances, never the
passport/visa-history free-text unless the question is explicitly about visa
risk, and even then only the structured outcome, not the encrypted DB row
directly.

**Sample real output** (Aarati Sharma, asked "How much money do I need to
show for my Australian student visa, and what documents do I need?"):

> To meet the financial capacity requirements for a student visa, you must
> provide proof of at least $29,710 in savings to cover costs such as travel,
> course fees, and rent [1]. … Regarding documentation, the application
> process begins with receiving a Letter of Offer from your education
> provider … [2]. … you must satisfy the Genuine Student (GS) requirements …
> [1]
>
> **Visa-Risk Commentary** — Your high PR intent is noted; however, you must
> clearly demonstrate how your chosen course aligns with your genuine
> intention to study [1].
>
> This is advice, not a guarantee of admission or a visa grant. …

Correctly cited, correct real current figure, visa-risk kept in its own
labelled section, disclaimer present. A visa-refusal question and a
no-student-context exploratory question were also spot-tested (full text in
`/tmp/q2.json`, `/tmp/q3.json` on this machine) — both correctly said
"unconfirmed" rather than inventing an answer where the corpus didn't cover
something.

## 4. The 100-student batch

`scripts/gen-test-students.mjs` generates 100 varied synthetic intakes (all
4 GPA scales, all 4 English tests + 20% with none, single/married +
dependants, 5 preferred-country combinations, ~11% with a visa refusal,
budgets $28k–$65k AUD, every degree level, every long-term goal) — clearly
synthetic (`(QA1)…(QA100)` in the name), not real people, tagged
`branch = "QA Batch 2026-09-02"`.

`scripts/run-qa-batch.mjs` ran intake → derive profile → `POST /match/runs`
for all 100, plus 1–2 targeted AI questions (visa-risk if they have a
refusal, English-options if no test on file, always an explain-my-top-match)
for every 3rd student — 41 questions total.

**Result: 100/100 created, 100/100 matched, 0 backend errors, 41/41 AI
questions answered (0 failed, 1 degraded to the templated fallback — a
transient issue before I'd finished the paid-model switch, not seen again
after).**

**34 of 100 students got zero match results** (every course knocked out).
Investigated one in detail rather than assuming it's a bug: GPA 80/100,
English 7.5, affordability 100/100 — knocked out purely on budget. Their
budget cap was $34,061/yr; the cheapest Master's course in the AU catalogue
is $38,000/yr. **Confirmed correct engine behaviour** — the knockout logic is
working exactly as designed, including on adversarial low-budget synthetic
inputs, not silently returning bad matches. Worth knowing for real usage: a
meaningful fraction of real students will hit the same wall if their stated
budget is genuinely below every seeded course's tuition — the frontend's
"every course was knocked out" warning is the right UX for it; a production
version might additionally suggest "raise your budget by $X to unlock N
courses."

Full machine-readable batch report: `/tmp/qa-batch-report.json` (per-record
profile, match summary, AI Q&A with citations/confidence/timing).

**These 105 records (5 from an initial pilot run + the 100) are real rows in
your dev database right now**, filterable by `branch = 'QA Batch 2026-09-02'`.
I left them in — you asked to test against them, so purging felt like the
wrong call to make unilaterally. To remove them later:

```sql
DELETE FROM student WHERE branch = 'QA Batch 2026-09-02';  -- cascades to all Side A tables + student_profile/match_run (FK cascade)
```

## 5. What's still not done

- No real login form (unchanged from the last session — the demo-account
  auto-sign-in is still how the frontend authenticates).
- The AI orchestrator's model-selection/budget policy is hardcoded, not in
  `.env` — fine for tonight's scale, not for a real deployment.
- `cricos.education.gov.au` and the primary `immi.homeaffairs.gov.au` pages
  are not in the KB (see §2) — the corpus currently covers visa process,
  costs, scholarships, work rights, and 3 of the 8 seeded universities.
  Broadening it (more universities, the CRICOS registry via its actual API
  rather than the JS page, a licensed Home Affairs feed) is a deliberate next
  step, not something to auto-expand further unattended.
- No reranking model in the retrieval pass (plan appendix's "cheap rerank"
  step) — cosine + keyword blend only. Retrieval quality looked good in
  spot-checks but wasn't rigorously scored against a labelled eval set.
- Citation-extraction from the model's prose is regex-based (`[n]` /
  `[n, m]`) — works, but a model that cites differently (e.g. "[1][2]" with
  no comma, or names the source instead of a bracket number) would silently
  under-cite. Worth hardening if this becomes user-facing.

## 6. State left for you

- Docker stack: up (`server-db-1`, `server-redis-1`, `server-minio-1`).
- API: running (`node dist/main.js`, port 3000). `curl localhost:3000/health`.
- DB: seed (15 students, 8 unis, 36 courses) + 105 QA students + 12 KB docs /
  30 chunks + 108 match runs + 52 assistant conversations.
- New/changed files: `server/src/modules/knowledge/**`,
  `server/src/modules/assistant/orchestrator.service.ts` (+ service/module
  edits), `server/src/migrations/1788290000000-Knowledge.ts`,
  `1788291000000-MessageMeta.ts`, `server/scripts/{integration-test,
  ingest-corpus,gen-test-students,run-qa-batch}.mjs`, this report.
- `.env`: `OPENROUTER_API_KEY` unchanged (you set it); no other secrets
  touched.
