# Question taxonomy — onboarding to visa success to counsellor

Every realistic question a student or counsellor could ask this system,
grouped by journey stage, with an honest answerability rating for each
category based on what's actually wired up (not aspirational). Compiled
2026-09-02 as part of validating "does the system answer the full journey,"
not just the visa-narrow slice tested earlier.

**Legend**: ✅ answerable now (real data, tested) · ⚠️ partially (real data
exists but coverage is thin, or the answer is necessarily generic) · ❌ not
answerable from any real source available (flagged, not faked).

---

## 1. Onboarding / exploratory (pre-intake)

| # | Question | Answerable via | Status |
|---|---|---|---|
| 1.1 | I don't know which country to study in — where should I look? | AI, general guidance (AU-only catalogue, so scoped to AU) | ✅ |
| 1.2 | What fields/careers are in demand for someone with my background? | AI + `areas-of-study` doc | ⚠️ generic, not labour-market-data-backed |
| 1.3 | How does the whole process work, start to finish? | AI + `visa-application-process`, `how-to-apply-to-study` docs | ✅ |
| 1.4 | What documents do I need just to get started? | AI + KB | ✅ |
| 1.5 | I have a Bachelor's in X — what Master's programs make sense? | Match engine (needs intake) or catalogue-search tool | ✅ |
| 1.6 | What's the difference between a Bachelor's, Graduate Diploma, and Master's? | AI + `australias-education-system` doc | ✅ |
| 1.7 | Can I study in Australia with no English test yet? | Engine (no-test allowance) + AI | ✅ (tested — archetype `no_english_test_urgent`) |

## 2. Course & university selection

| # | Question | Answerable via | Status |
|---|---|---|---|
| 2.1 | What Master's courses does RMIT offer in Cybersecurity? | Catalogue-search tool (real DB, 3,508 courses) | ✅ tested, fixed twice (see follow-up report) |
| 2.2 | How much does a Master of Data Science cost at [university]? | Catalogue-search tool | ✅ |
| 2.3 | What's the entry requirement (GPA/English) for this course? | Catalogue data — **estimated, not CRICOS-sourced** | ⚠️ honestly labelled estimate |
| 2.4 | What's the course structure / subjects / curriculum? | — | ❌ not in CRICOS or any ingested source; would need per-course handbook pages (mostly JS-rendered or blocked) |
| 2.5 | Which university has the best reputation/ranking for X field? | `world_rank` (real, curated) + AI | ✅ for ranking; ❌ for field-specific rankings (QS subject rankings not ingested) |
| 2.6 | Can I get credit for my prior study (RPL / advanced standing)? | AI + `changing-your-course-or-provider` doc (adjacent) | ⚠️ general guidance, not per-course RPL policy |
| 2.7 | What's the difference between VET and university pathways? | AI + `vocational-education-and-training` doc | ✅ |
| 2.8 | List of all Australian universities | `list-of-australian-universities` doc (ingested) — but our catalogue only has 8 of them | ⚠️ narrative list real; structured catalogue limited to 8 |
| 2.9 | Is this course CRICOS registered? | Every catalogue course carries a real CRICOS code | ✅ |
| 2.10 | Can I change my course or provider after starting? | `changing-your-course-or-provider` doc | ✅ |

## 3. Financial

| # | Question | Answerable via | Status |
|---|---|---|---|
| 3.1 | How much does it cost in total (tuition + living)? | Match engine (real tuition) + `living-and-education-costs`, `costofliving.studyaustralia.gov.au` | ✅ |
| 3.2 | What's the cost of living in [city]? | `locations-in-australia`, cost-of-living docs | ✅ (city-level, not suburb-level) |
| 3.3 | Can I afford this given my savings/income? | Engine's `affordability_score` + AI | ✅ tested extensively (100+ synthetic cases) |
| 3.4 | What scholarships am I eligible for? | Engine's `scholarship_opportunities` (from catalogue `scholarship` rows) + `scholarships` doc | ⚠️ narrative real; **no scholarship rows are populated per real course yet** (CRICOS doesn't carry them) |
| 3.5 | Do I need an education loan, and how much? | AI, derived from affordability gap | ✅ reasoning; ❌ no lender-specific data |
| 3.6 | How do I show proof of funds for the visa? | `visa-application-process` doc | ✅ |
| 3.7 | My family income is informal/unregistered — is that a problem? | AI (tested — archetype `weak_financial_evidence`) | ✅ |
| 3.8 | What if my sponsor isn't my parent? | Engine handles arbitrary `sponsors[]`; AI narrates | ✅ tested (`fully_sponsor_funded`) |

## 4. Visa / immigration

| # | Question | Answerable via | Status |
|---|---|---|---|
| 4.1 | What visa do I need? | `your-guide-to-visas` doc | ✅ |
| 4.2 | What's the visa process and timeline? | `visa-application-process` doc | ✅ |
| 4.3 | What is the Genuine Student (GS) requirement? | Same doc, explicitly covered | ✅ |
| 4.4 | I've been refused a visa before (this or another country) — what now? | Engine flags it as a concern (separate from match score) + AI | ✅ tested extensively (`double_visa_refusal`, `worst_case_composite`) |
| 4.5 | **Which university/college gives the best chance of visa approval?** | Real Home Affairs grant-rate stats — **by sector/state/citizenship-year, not by institution** (not published anywhere) | ⚠️ answerable honestly (sector-level real stats), explicitly **not** answerable per-institution — see the follow-up report's dedicated section |
| 4.6 | Can my spouse/children come with me? | `bringing-your-family` doc + engine's dependant living-cost calc | ✅ tested (`large_family_living_costs`) |
| 4.7 | What are my work rights while studying? | `work-rights-and-responsibilities` doc | ✅ |
| 4.8 | What happens after I graduate — can I work / get PR? | `work-after-graduating` doc + engine's PR-pathway bonus | ✅ tested (`pr_pathway_bonus_field`) |
| 4.9 | I don't have a passport yet — how urgent is that? | Engine's `missing_info` flag + AI | ✅ tested (`no_passport_yet`) |
| 4.10 | What health insurance (OSHC) do I need? | `overseas-student-health-cover-oshc` doc | ✅ |
| 4.11 | What English tests are accepted and where do I sit them? | `language-testing-organisations` doc + engine's accepted-tests list | ✅ |
| 4.12 | Is the overall visa approval trend getting better or worse? | Real Home Affairs time-series (2019-2025) | ✅ (a real, current, somewhat concerning trend — see follow-up report) |

## 5. Application process

| # | Question | Answerable via | Status |
|---|---|---|---|
| 5.1 | How do I actually apply? | `how-to-apply-to-study` doc | ✅ |
| 5.2 | What's the application deadline for this course? | Catalogue data (estimated forward-looking dates — CRICOS has no live deadlines) | ⚠️ estimated, not live |
| 5.3 | How long until I get an offer? | — | ❌ not in any ingested source |
| 5.4 | What's a Letter of Offer / conditional vs unconditional? | `visa-application-process` doc | ✅ |
| 5.5 | Tips for writing a Statement of Purpose | — | ❌ not ingested (a real, addressable gap — playbook content, not public web content) |
| 5.6 | What if my course/university preference doesn't match my profile well? | Engine's `alternatives` field + AI explain-match | ✅ tested (`career_pivot_unrelated_field`, `budget_below_market`) |

## 6. Pre-departure / arrival / settling

| # | Question | Answerable via | Status |
|---|---|---|---|
| 6.1 | What should I pack / bring? | `what-can-i-bring-to-australia` doc | ✅ |
| 6.2 | What do I do in my first week? | `your-first-week-in-australia` doc | ✅ |
| 6.3 | What accommodation options exist? | `accommodation` doc | ✅ |
| 6.4 | Is Australia safe? What precautions should I take? | `safety-in-australia` doc | ✅ |
| 6.5 | What support services exist for international students? | `student-support-services` doc | ✅ |
| 6.6 | What's Australian culture/lifestyle like? | `australian-culture-and-lifestyle` doc | ✅ |
| 6.7 | Which city should I pick — big vs regional? | `locations-in-australia` doc + engine's location score | ✅ tested (`regional_cost_sensitive`) |

## 7. During study / post-study

| # | Question | Answerable via | Status |
|---|---|---|---|
| 7.1 | Can I work part-time while studying, and how much? | `work-rights-and-responsibilities`, `finding-work-while-you-study` (not yet ingested) | ⚠️ |
| 7.2 | What if I want to change my course or provider? | `changing-your-course-or-provider` doc | ✅ |
| 7.3 | What are typical career outcomes for graduates? | `student-employability-stories` (not yet ingested) | ❌ |
| 7.4 | What's the pathway to permanent residency after graduating? | `work-after-graduating` doc + engine's PR-intent field | ✅ |

## 8. Counsellor-facing (internal use)

| # | Question | Answerable via | Status |
|---|---|---|---|
| 8.1 | Explain why this match score is what it is | AI explain-match (tested extensively) | ✅ |
| 8.2 | What's this student's overall risk profile? | Visa history + affordability + academic subscores, permission-gated | ✅ |
| 8.3 | Draft a follow-up note for this student | Follow-ups CRUD exists; AI drafting not wired to it | ⚠️ AI can compose text; doesn't auto-file a follow-up yet |
| 8.4 | Compare two students side by side | — | ❌ no comparison endpoint/UI yet |
| 8.5 | Show me the branch's pipeline / conversion stats | — | ❌ analytics module not built (PRODUCT_PLAN P4, still future) |
| 8.6 | Which of my students have zero real matches right now and need attention? | `noRealMatch`/knockout data exists per match run; no dedicated report endpoint | ⚠️ derivable from raw data, no UI for it yet |

---

## Honest summary

**Strong** (real data, tested, reliable): course/fee/university facts (3,508
real CRICOS courses), the full deterministic matching + explanation loop,
visa process/rules/family/health/work-rights/settling narrative (32 real
government-source documents), financial reasoning at any complexity
(sponsors, dependants, weak evidence, multiple income sources), the
sector-level (not institutional) visa grant-rate picture.

**Thin but honest** (real but shallow): scholarships (no per-course rows,
narrative-only), application deadlines/intake dates (estimated, not live),
subject-specific rankings, career-outcome data, part-time-work specifics.

**Not answerable, clearly flagged, not faked**: full course curricula/subject
lists, per-institution visa grant rates (nobody publishes this), how long an
offer takes, SOP-writing guidance, career-outcome statistics, counsellor
analytics (pipeline/comparison/conversion — a separate, larger build).

Section 4.5 (per-institution visa success rate) is the one question in this
whole taxonomy where the honest answer is structurally "the data doesn't
exist publicly" rather than "we haven't ingested it yet" — worth remembering
before promising a fix, because there isn't a source to ingest.
