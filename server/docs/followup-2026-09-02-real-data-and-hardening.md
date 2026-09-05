# Follow-up session — 2026-09-02: real course data, production hardening, complex test suite

Continuation of `overnight-qa-report-2026-09-02.md`, same running stack. Three
things were asked for and are all done: (1) alternative accessible sources
beyond studyaustralia.gov.au, (2) real college/course/price data, (3) 100
*practical, complex* test cases rather than randomised ones. Given explicit
license to "make autonomous calls and add value," I also went through a
production-hardening pass and added a real login screen.

## TL;DR

- **Real course catalogue**: the synthetic 36 courses are gone. **3,508 real
  courses across the same 8 universities**, sourced from the Australian
  Government's own CRICOS register (data.gov.au open data), with **real
  published tuition fees** ($12k–$160k/yr), not estimates.
- **100 complex test cases, hand-designed**: 20 real consultancy problem
  archetypes (borderline GPA, double visa refusal, budget-vs-scholarship
  dependency, career pivots, PR-track fields, large families, no passport, a
  deliberately worst-case composite, etc.) × 5 parameterised variants each —
  **97/100 pass**; the 3 non-passes are an accurate, informative finding, not
  a bug (see §3).
- **Production hardening**: Redis-backed rate limiting, a consistent error
  envelope, request logging, `/health` vs `/health/ready` (DB-checked),
  Swagger docs at `/docs`, helmet + compression, graceful shutdown, a
  multi-stage `Dockerfile`, and an opt-in full-stack `docker compose` profile.
- **Real login screen** — the frontend no longer silently auto-signs-in;
  there's an actual sign-in form gating every route.
- Two bugs found and fixed in **my own test scripts** (not the product): a
  batch that outran its JWT's 15-minute TTL, and a CRICOS data artifact
  (joint-degree $0/$1 fees) that needed a realistic-fee floor on import.
- OpenRouter spend for all of this: **~$0.04** (of the $1.66 that remained).
  $1.62 left.

## 1. Alternative real sources (beyond studyaustralia.gov.au)

The single most valuable find: the **Department of Education's own CRICOS
register**, published as open data on **data.gov.au** — the same PRISMS
system that backs the CRICOS website — as monthly CSV/XLSX exports. This is
where the real course catalogue below comes from (§2).

Other real, currently-accessible sources worth knowing about:

| Source | What it has | Access |
|---|---|---|
| `data.gov.au` — CRICOS dataset (`package_search?q=CRICOS` via the CKAN API at `/data/api/3/action/...`, not `/api/3/...`) | Every registered course + institution + **real tuition fee, non-tuition fee, total cost, duration** | Bulk CSV, no scraping, updated monthly |
| `studyaustralia.gov.au` (already ingested) | Visa process, costs, scholarships, work rights | Open `robots.txt`, reliably reachable |
| `costofliving.studyaustralia.gov.au` (already ingested) | A dedicated cost-of-living tool/page | Same |
| `cricos.education.gov.au` | The live course-search UI | **Blocked for our purposes** — JS-rendered, too little static text; use the data.gov.au CSV instead |
| `immi.homeaffairs.gov.au` (Dept. of Home Affairs itself) | The primary visa legal source | **Blocked** — Akamai WAF 403s non-browser UAs, even for its own `robots.txt`. Not bypassed. `studyaustralia.gov.au` is the same government's own study-facing equivalent |
| University sites (RMIT, Sydney, UQ — reachable; Melbourne, Deakin, Monash, UNSW, UWA — blocked) | Narrative institution policy pages | Mixed; unaffected by the CRICOS catalogue switch since that comes from data.gov.au, not these pages |

None of the blocked sources were bypassed with UA-spoofing, headless-browser
tricks, or proxies — they're logged as inaccessible and worked around with an
equally-official alternative where one exists (data.gov.au for CRICOS,
studyaustralia.gov.au for Home Affairs–equivalent guidance).

## 2. Real college/course/price data

`server/data/cricos/` — a scoped snapshot (institutions.csv + courses.csv,
~1MB) filtered from the national CRICOS export to the 8 universities already
in the catalogue, non-expired courses at Bachelor/Bachelor Honours/Graduate
Certificate/Graduate Diploma/Masters (Coursework, Research, Extended)/
Doctoral level. Full provenance and refresh instructions in
`data/cricos/README.md`.

`server/src/seed/cricos-import.ts` replaces the old synthetic catalogue:
**real course titles, real CRICOS codes, real tuition fees** (the source
field is total-course-cost; the importer divides by `duration_weeks/52` to
get the per-year figure the engine expects), real field-of-education
classification, real course durations. City and world-rank aren't in CRICOS
data, so those stay as the previously-curated values (real, just not
re-derived from this file).

**Not in CRICOS** (so not real, and clearly marked as such in code + docs):
per-course entry requirements (min GPA/English band), work-experience
prerequisites, scholarships, live intake dates. These get documented
estimated defaults by course level. This is an honest limitation, not
something to silently gloss over — getting real per-institution admissions
criteria is a genuine follow-up (would need either per-institution scraping
at scale or a licensed data source).

**Data-quality fix applied**: joint/partner-institution research degrees
(e.g. "Doctor of Philosophy (Beihang - Monash)") show `$0`–`$1` fees in the
government's own export, because the partner institution bills tuition —
found via a real test failure (§3), not by inspection. `Dual Qualification`
doesn't reliably flag these, so the importer now requires a realistic
`$3,000` minimum fee (42 of 3,550 rows excluded).

**Result**: 3,508 real courses, fees now ranging $12,240 (cheapest real
Bachelor's) to $160,208/yr (Doctor of Medicine) — verified via direct query,
not assumption. The frontend catalogue's tuition slider was hardcoded to a
$30k–$70k range tuned for the old synthetic data (silently hiding everything
outside it) — widened to $10k–$170k to match reality.

## 3. 100 complex, practical test cases

`server/scripts/gen-complex-cases.mjs` — **20 hand-designed archetypes**,
each a real thing a consultancy actually deals with, 5 parameterised variants
each:

`budget_below_market` · `no_english_test_urgent` · `career_pivot_unrelated_field`
· `double_visa_refusal` · `large_family_living_costs` · `scholarship_dependent`
· `borderline_gpa` (inside the knockout tolerance) · `overqualified_downgrade`
· `gpa_scale_boundary` (division/percentage edge values) · `pr_pathway_bonus_field`
· `regional_cost_sensitive` · `undecided_split_countries` · `weak_financial_evidence`
· `zero_experience_experience_preferred` · `fully_sponsor_funded` ·
`justified_field_change` · `high_budget_ranking_obsessed` · `study_gap` ·
`no_passport_yet` · `worst_case_composite` (every hard factor stacked at once).

Each declares an explicit `expect` assertion checked against real output
(match results, subscores, missing_info/concerns text, and/or the AI answer)
— `server/scripts/run-complex-cases.mjs` is a real regression suite, not a
load test. Run against the real 3,508-course catalogue and the real AI agent.

**Result: 97/100 pass.** Two real bugs surfaced and were fixed mid-run:

1. **My test script, not the product**: the run took long enough (many AI
   calls at 5–25s each) to outrun the JWT's 15-minute access-token TTL —
   16 late-batch cases 401'd. Fixed with a proactive re-login every 8
   minutes; confirmed clean on re-run (0 auth errors in 100 cases).
2. **The CRICOS $0/$1 artifact** (§2) — first surfaced as this suite's very
   first failure (`budget_below_market` expected 0 matches, got 8, because a
   $1/yr joint-PhD program survived the budget knockout). Led directly to
   the fee-floor fix.

I also caught **two of my own test assertions being wrong**, not the system:
- `budget_below_market` originally asserted "zero matches" — but knockout is
  budget/GPA/English/deadline only; a **degree-level mismatch is a scoring
  penalty, not a knockout** (by design — a cheap Bachelor's alternative for a
  budget-locked Master's-seeker is a *better* answer than nothing). Corrected
  to check that any survivor is a genuinely weak fit (`overall < 55`), which
  is the real invariant.
- `zero_experience_experience_preferred` asserted a low career score from the
  engine's "experience preferred" penalty — but since CRICOS carries no real
  work-experience requirements, every imported course defaults to
  `work_experience_months: 0`, so that penalty structurally cannot fire
  against real data. Corrected to a basic sanity check; the real test of
  "should I work first" lives in the AI's grounded answer instead.

**The remaining 3 non-passes** (`budget_below_market`, variants 3–5) are
informative, not bugs: those variants' budgets ($18k–$20k/yr) sit right at
the real market's floor for a Bachelor's degree (now $12,240 minimum after
the fee-floor fix) — so a handful of genuinely affordable-if-you'll-accept-a-
Bachelor's courses correctly survive with a moderate score (~61–62), rather
than everything being knocked out. That's the real Australian education
market's price floor showing up in the test, not an engine defect. I left
these as failing rather than loosening the threshold further to force a
100% pass rate — that would hide a real, useful signal about where the
"budget genuinely too low" line actually sits.

Full machine-readable report: `/tmp/complex-cases-report.json` (every
case's engine output + AI answer preview + citations + verdict + notes).

## 4. Production hardening (autonomous, per your go-ahead)

- **Rate limiting** — `@nestjs/throttler` + Redis storage (`@nest-lab/throttler-storage-redis`,
  using the Redis container you already had running for exactly this).
  Global default + a tighter cap on `/auth/login` (brute-force target).
  Verified: 11th login attempt in 60s → `429`.
- **Consistent error envelope** — every error response is now
  `{statusCode, error, message, path, timestamp}`; no raw stack traces leak
  to the client; 5xx errors are server-logged, 4xx aren't (expected traffic).
- **Request logging** — one line per request (method/path/status/ms/caller).
- **Health checks split**: `/health` (liveness) vs `/health/ready` (also
  pings the DB) — use the latter for orchestrator readiness gates.
- **API docs**: Swagger UI at `/docs`.
- **Security/perf middleware**: `helmet` (CSP off — this is a JSON API plus
  one Swagger HTML page, and default CSP blocks Swagger's inline bundle) and
  `compression`.
- **Graceful shutdown**: `app.enableShutdownHooks()` — DB/Redis connections
  close cleanly on `SIGTERM`, not just local `Ctrl+C`.
- **Containerized**: multi-stage `Dockerfile` (non-root user, healthcheck).
  `docker compose up -d` still starts only the infra as before — didn't want
  to disturb what was already running — but `docker compose --profile full up -d --build`
  now runs the whole stack, API included.
- **AI config externalized**: `OPENROUTER_CHAT_MODEL` / `_FALLBACK` /
  `_EMBED_MODEL` / `_MIN_BALANCE_USD` are now `.env`-driven instead of
  hardcoded constants.

**Real login screen** — `frontend/src/modules/@auth/login.tsx`: an actual
email+password form (with one-click "sign in as counsellor/branch-admin/
super-admin" demo shortcuts — still real `login()` calls, just pre-filled,
not a silent auto-login). Every route now sits behind `<Authenticated
fallback={<Navigate to="/login" />}>`; `authProvider.check()` no longer
transparently signs a visitor in. **Left as-is, flagged, not fixed**: the
top-bar role switch still re-authenticates as a seeded demo account with one
click — fine for this demo environment, a real security hole in an actual
production launch (anyone can become super_admin from the UI). Remove or
permission-gate it before going further than a demo.

## 5. Verification

- Golden engine test: 13/13.
- Integration suite: 36/36 (real MinIO round-trip included).
- 100-profile QA batch (previous session) + 100 complex cases (this one):
  220 synthetic students total in the DB, 296 match runs, 229 AI
  conversations, 0 unexplained backend errors across all of it.
- `tsc --noEmit` and a production `vite build` clean on the frontend;
  `tsc --noEmit` and `nest build` clean on the backend.
- OpenRouter balance: **$1.62 of $5 remaining** (this session cost ~$0.04 on
  top of the prior session's ~$0.01).

## 6. What's still open

- Real per-course entry requirements / scholarships (CRICOS doesn't carry
  them) — biggest remaining data-quality gap.
- The demo role-switcher is a real security hole for an actual prod launch
  (§4) — needs removing or gating.
- No CI pipeline wired to run the golden test + integration suite on every
  change (they're scripts you run manually today).
- Retrieval still has no reranker and no labelled eval set (unchanged from
  the previous report).
- 220 synthetic QA students remain in the DB, tagged `branch = 'QA Batch
  2026-09-02'` / `'QA Complex 2026-09-02'` for easy purge:
  `DELETE FROM student WHERE branch LIKE 'QA %2026-09-02';`
