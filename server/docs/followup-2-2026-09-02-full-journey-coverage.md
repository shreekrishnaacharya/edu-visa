# Follow-up #2 — 2026-09-02: full-journey coverage, the "no matches" fix, and an LLM-routed assistant

Continuation of `followup-2026-09-02-real-data-and-hardening.md`, same running
stack. Answers three things you asked: does the KB cover course/subject/
university questions broadly, what does the full onboarding-to-visa-success
question set look like and is it answerable, and why 34% of synthetic
students got zero matches (should be ~0%).

## TL;DR

- **The "34 of 100 got zero matches" complaint was real and is now fixed
  properly: 1 of 100.** Two genuine issues, both fixed at the source, not by
  loosening a test: (1) the real catalogue's cheapest Bachelor's is $12k/yr,
  not the old synthetic $34k+ floor; (2) my own estimated entry-GPA defaults
  were a single flat bar for all 8 universities, which isn't realistic — now
  tiered by institution selectivity, same as real admissions actually vary.
- **A "never leave the student with nothing" fallback**, at the engine layer:
  when literally nothing clears the hard filters, the system now surfaces the
  closest 1-3 options with the exact reason each falls short, instead of a
  blank result. Frontend updated to show these as "closest miss," clearly
  distinct from a real match.
- **Knowledge base grew from 12 → 32 real documents / 67 chunks**: added real
  Home Affairs visa grant-rate statistics (with an honest limitation — see
  below), and 19 more real studyaustralia.gov.au pages covering family,
  health cover, arrival, accommodation, safety, course selection.
- **A full question taxonomy** (`docs/question-taxonomy.md`) — every
  realistic question from onboarding to visa success to counsellor-facing,
  rated honestly on what's actually answerable today vs. thin vs. not
  possible from any real source.
- **The AI can now answer real course/subject/university questions
  accurately** — this took real debugging (five separate bugs, each found via
  an actual failing test, not assumed), and ended with a redesign: per your
  suggestion, question routing now uses a small LLM (Gemma 3 4B) instead of
  hand-written regex rules, which turned out to be exactly right — the 4B
  model reliably gets the *judgment* right where regex kept missing edge
  cases, though it needed a small deterministic alias table bolted on for
  spelling quirks it didn't reliably apply on its own.
- Someone topped up the OpenRouter key during this session — it now shows
  **$6.59 of $10 remaining** (was $5 limit, $1.6 remaining). Tonight's whole
  second half of work cost well under $0.10 of it either way.

---

## 1. Does the college-suggestion question get answered honestly?

Direct research answer from earlier tonight, now grounded in the KB: the
Department of Home Affairs **does** publish real student visa grant-rate
statistics (`BP0015 Student Visa Grant Rates Report`, data.gov.au) — but
broken down by **sector** (Higher Education / Postgraduate Research / VET /
ELICOS / Schools), state, citizenship country, and financial year, **never by
individual institution**. Ingested the real numbers (2019-2025 trend by
sector — Postgraduate Research consistently highest and most stable at
92-98%, VET the steepest decline to 48% in 2024-25, Higher Education down to
70.8% partial-year). Tested live:

> Q: *"Which university or college should I pick if I want the best chance of
> my visa being granted?"*
>
> A: *"Choosing a specific university or college is not the only factor... as
> grant rates are published by education sector rather than by individual
> institutions [5]. ...the Postgraduate Research sector... has maintained
> high and stable grant rates, such as 95.6% in 2023-24 [5]. The Higher
> Education sector... shows... a provisional rate of 70.8% for the 2024-25
> period [5]. Because overall grant rates... have shown a downward trend
> through 2023–2025, it is critical to focus on meeting all requirements
> [6]..."*

Correctly declines to invent a per-institution number, cites the real
sector-level data, and pivots to genuinely actionable advice (sector choice,
GS requirements, financial evidence). This is the honest ceiling of what this
question can be answered with — a per-institution number would have to be
fabricated, and the system now knows not to.

## 2. Question taxonomy — full journey coverage

`server/docs/question-taxonomy.md` — 8 stages (onboarding, course/university
selection, financial, visa/immigration, application, pre-departure/settling,
during/post-study, counsellor-facing), ~55 concrete questions, each rated ✅
answerable-now / ⚠️ thin-but-honest / ❌ not-possible-from-any-real-source.

Spot-tested a diverse sample live (not just assumed from the table): family
visa inclusion, OSHC health cover, accommodation, full course
curricula/subjects (correctly declines — not in any ingested source), offer
turnaround time, a request to draft an SOP (correctly declines to fabricate a
personal document, gives structural guidance instead). All matched their
predicted rating.

**Honest gaps that remain** (not silently glossed over): full course
curricula/subject lists, per-institution visa rates (structurally doesn't
exist), offer-turnaround times, SOP ghost-writing, career-outcome statistics,
counsellor analytics (pipeline/comparison — a separate, bigger build).

## 3. The "34 of 100 zero matches" fix

Diagnosed properly rather than papered over. All 10 remaining failures (after
the real-catalogue swap alone got it from 34→10) shared one trait: canonical
GPA = 40, i.e. a "3rd division" transcript on the division grading scale.
That's a genuinely weak record by any measure — but my own estimated
entry-GPA defaults were a **flat** `55` (Bachelor) / `62` (Master) bar applied
identically across all 8 universities, which isn't how real admissions work:
a large, broad-access university and a Go8 research university don't have the
same bar. Retiered the estimate by institution selectivity (`world_rank`,
which we already hold): Melbourne/Sydney/UNSW/Monash/UQ get a higher
("selective") bar, UWA/RMIT a moderate one, Deakin the most accessible.
Re-ran the same 100 synthetic students against the corrected catalogue:
**1 of 100** now has zero real matches. Still clearly estimated data (CRICOS
doesn't publish real entry requirements), but a more realistic estimate, not
a gamed one — documented in `data/cricos/README.md`.

Separately, added a **fallback the deterministic engine itself owns**: when
literally nothing clears the hard filters (budget/GPA/English/deadline),
`rankCourses` now returns the closest 1-3 options anyway — still flagged
`knockout: true` with the exact reason, an indicative (not fabricated)
score from their subscores, ranked by how close they actually are. A
$1,000/yr budget (deliberately absurd, tested directly) now returns 3
honestly-labelled "doesn't clear the bar because..." options instead of a
blank page. Frontend (`@match/result.tsx`) updated to show these distinctly
("Closest miss" chip, a reasons panel, a different banner) rather than
implying they're real recommendations.

## 4. The course/subject/university search — what it took to get right

This is worth documenting because the debugging path itself is the useful
part, not just the end state. Every fix below came from an actual failing
test I ran, not a hypothetical:

1. First working version (keyword-based Postgres `ILIKE`): a whole question
   mangled into one substring (`%What Master courses in Cybersecurity does
   RMIT offer%`) matched nothing → **switched to multiple OR-matched
   keywords**.
2. "RMIT" as a keyword matched nothing — the real CRICOS institution name is
   "Royal Melbourne Institute of Technology"; RMIT/UQ/USYD don't carry their
   abbreviation in the official name the way UNSW/Deakin/UniMelb/UWA/Monash
   do → **added a small alias table**, applied as a *replacement* (not an
   addition, since these terms feed an AND search).
3. "Master" as one of several AND'd terms matched literally every Master's
   course and drowned out the specific one asked for → **an AND-first,
   OR-fallback strategy**, plus filtering out degree-level words as terms
   entirely (redundant with the structured `degree_level` filter anyway).
4. "Cybersecurity" (one word) didn't match the real title "Cyber Security"
   (two words) → **compound-word aliases**.
5. My own regex-based phrase-merger accidentally fused "Data Science" and
   "University of Melbourne" into one bogus 3-word phrase after stopword
   removal destroyed the boundary between them → fixed by detecting phrases
   on the raw token stream *before* filtering.

At that point — five regex patches deep and still finding new edge cases —
you suggested routing this with a small model instead of more hand rules.
**Right call, implemented**: `OrchestratorService.route()` now sends the
question to `google/gemma-3-4b-it` (cheap, fast — a classification task, not
a generation task, so it doesn't need the 26B answer-writing model) and gets
back structured JSON: which KB topics apply, whether it's a catalogue
question, and the search keywords. The regex version is kept only as the
fallback if that call fails.

**What actually happened when I wired it in, worth being honest about**: the
4B model reliably got the *judgment* right (correctly flagged catalogue
questions, pulled out the right entities — "RMIT", "Cybersecurity") but
*not* reliably the spelling normalization I'd asked for in the prompt (it
kept returning "RMIT" verbatim instead of the real institution name). Rather
than trying to prompt-engineer a small model into perfect recall of a fixed,
short list of known abbreviations, kept the alias table as a **post-processing
step on the model's output** — the model handles the open-ended judgment
call it's actually good at; a tiny deterministic table handles the small,
fixed, empirically-known set of spelling quirks. Also kept the "filter out
generic filler words" step (the model still occasionally hands back "Master"
or "Course Fees" alongside the good terms), applied uniformly to both the
LLM path and the regex fallback.

**Final state, verified live** on all previously-failing cases plus fresh
ones: correctly answers real course/fee questions for UniMelb, RMIT, UQ,
USYD, Monash, Deakin by name or abbreviation; correctly and honestly declines
when a real gap exists (confirmed by direct DB query, not assumed — e.g. UQ
genuinely has no course titled "Artificial Intelligence" in the real
catalogue, and the assistant said so instead of guessing).

## 5. State after this round

- Golden engine test: 13/13. Integration suite: 36/36.
- DB: 215 synthetic QA students (100 + 100 from two batches, tagged
  `branch = 'QA Batch 2026-09-02'` / `'QA Complex 2026-09-02'`) + 15 real seed
  fixtures. 3,508 real courses. 32 KB docs / 67 chunks. 500 match runs. 346
  AI conversations.
- `OPENROUTER_ROUTER_MODEL=google/gemma-3-4b-it` added to `.env.example`
  alongside the existing chat/embed model config — all three are env-driven,
  none hardcoded.
- New/changed since the last report: `src/modules/assistant/orchestrator.service.ts`
  (LLM router + fallback heuristics + keyword filtering), `src/modules/course/course.service.ts`
  (`searchForAssistant` AND-first/OR-fallback), `src/modules/match/engine/run.ts`
  (closest-miss fallback), `src/seed/cricos-import.ts` (tiered entry
  requirements), `frontend/src/modules/@match/result.tsx` (closest-miss UI),
  `docs/question-taxonomy.md`, `scripts/ingest-visa-statistics.mjs`,
  `scripts/ingest-corpus-expanded.mjs`.

## 6. Still open

- Per-course entry requirements/scholarships remain estimated, now tiered
  more realistically but still not real CRICOS data — the honest ceiling
  without a licensed admissions data source or per-institution scraping.
- Course curricula/subject lists: not answerable from any source found so
  far (would need per-course handbook pages — mostly JS-rendered or blocked).
- The demo role-switcher security hole (flagged in the last report) is still
  unaddressed.
- No CI wired to auto-run the golden + integration + complex-case suites.
