# AI Consultant chat UI — 2026-09-02

The AI assistant backend (`POST /assistant/messages`, the LLM-routed
`OrchestratorService`) has existed since the overnight build and was fully
tested via curl, but there was **no way to reach it from the React app** —
you asked for a way to interact with it for a given student, from inside
that student's profile.

## What's there now

A new **"AI Consultant" tab** on the student profile page (first tab, before
Academic), with a robot icon. Open any student → AI Consultant tab → chat.

- **New file**: [frontend/src/modules/@student/show/ai-consultant.tsx](../../frontend/src/modules/@student/show/ai-consultant.tsx)
  — `AiConsultantTab({ studentId })`, following the same pattern as the
  existing `FollowUpTab`/`DocumentsTab` in `records.tsx` (a sibling component
  file, plain `axiosInstance` calls to the real API, no mocks).
- **Wired in**: [frontend/src/modules/@student/show/show.tsx](../../frontend/src/modules/@student/show/show.tsx)
  — new `Tab`/`TabPanel` pair, imports `AiConsultantTab`.
- **One new backend endpoint**, needed because none existed to load a
  student's existing chat thread on open:
  - `GET /assistant/students/:studentId` → `{ conversation_id, messages[] }`
    — the student's most recent conversation and its full message history.
    (`AssistantService.getLatestForStudent`, `AssistantController`.)
  - The existing `POST /assistant/messages` is unchanged — the UI sends
    `{ conversation_id?, student_id, body }` and gets back `{ conversation_id, reply }`.

## How it works

1. **On open**: fetches `GET /assistant/students/:studentId`. If the student
   has a prior conversation, it loads in full (this reuses the same
   conversation on every visit — it does not start a new thread each time).
   If not, shows a blank state with the AI's avatar and four clickable
   starter questions (best-visa-outcome course, funds required, scholarship
   eligibility, required documents) — chosen from the question taxonomy
   (`docs/question-taxonomy.md`) as broadly-answerable, high-value ones.
2. **Sending**: types a question, Enter (Shift+Enter for a newline) or the
   send button. The user bubble appears immediately (optimistic); on
   failure it's rolled back and the text restored to the input rather than
   silently vanishing.
3. **Receiving**: the assistant's reply renders with:
   - **Citation chips** (`[1]`, `[2]`, …) — each links out to the real
     source URL (`meta.cites[].source_url`) it drew from, opened in a new
     tab. This surfaces the orchestrator's grounding directly rather than
     asking you to trust an uncited claim.
   - A **"Degraded answer" warning chip** when `meta.degraded` is true (the
     LLM routing or generation call fell back to a simpler path) — so a
     lower-confidence answer is visibly flagged, not indistinguishable from
     a normal one.
   - A **confidence percentage** (`meta.confidence`) alongside the
     timestamp.
4. **Loading states**: a spinner while history loads, a "Thinking…" indicator
   while waiting on a reply, and an inline error `Alert` (not a silent
   failure) if the request fails.

## Verified live (not just built)

Ran the actual flow through the running API, not just typecheck/build:

- `GET /assistant/students/:id` on a student with no prior chat →
  `{"conversation_id":null,"messages":[]}` (blank-state path).
- `POST /assistant/messages` with a real question ("What English test score
  do I need?") against that student → real cited answer referencing their
  actual profile (their IELTS-equivalent score) and the real visa-500
  English-requirement source.
- `GET /assistant/students/:id` again → returns both messages in order, with
  `meta.cites` populated exactly as the UI component expects
  (`{chunk_id, source_url}[]`), same shape as `OrchestratorResult` in
  `orchestrator.service.ts`.

## Also verified

- `cd frontend && npx tsc --noEmit` — clean, no type errors.
- `cd frontend && npx vite build` — clean production build.

## Follow-up fix — citation links (broken + duplicated)

You reported two real bugs after trying it live:

1. **Citation chips opened on our own domain and 404'd** instead of the real
   source. Two separate causes, both fixed:
   - **Frontend**: `Chip`'s `component={Link} href=…` composition didn't
     reliably forward to a real anchor, so clicks fell through to the SPA
     router. Fixed by opening the URL explicitly via `window.open()` on
     click instead of relying on that composition.
   - **Data**: 3 of the 34 KB documents (the legislation.gov.au instrument,
     the data.gov.au grant-rate dataset, and the internal VM-3680 procedural
     instruction) had a human-readable description appended into the
     `source_url` field itself — one had *no real URL at all* (VM-3680 is an
     internal document with no public page). Cleaned the DB rows directly
     and fixed the two ingestion scripts (`ingest-official-visa-docs.mjs`,
     `ingest-visa-statistics.mjs`) so re-running produces clean data. Also
     found the same pattern in `OrchestratorService`'s live-web-fetch
     fallback and its own course-catalogue citations (a `catalogue:course/…`
     pseudo-URL, also not a real link) — fixed both.
2. **The same reference appeared as multiple duplicate chips.** The
   orchestrator only deduped citations by numeric index, not by what they
   actually pointed at — two chunks of the *same* source document (e.g. two
   passages from the same visa-guidance page) produced two separate chips
   for the identical link. Fixed by deduping by `source_url` (or `title`
   when there's no URL) before returning citations, both server-side
   (`orchestrator.service.ts`) and defensively client-side (covers messages
   already saved to the DB before this fix).

**Broader design change**: citations now carry a `title` (joined from
`doc.title` in `RetrievalService`, not previously exposed to the frontend)
alongside `source_url`. A citation with no real public URL (an internal
document, or a course-catalogue row) now renders as a **non-clickable**,
slightly muted chip showing its title on hover — instead of either a broken
link or being silently indistinguishable from a real one.

Verified live via curl: a financial-capacity question now returns one real
clickable `legislation.gov.au` citation and one correctly non-clickable
internal-document citation, no duplicates. `tsc --noEmit` clean on both
sides; `engine-golden` test suite still 13/13 (untouched).

## Known limitations / follow-up

- One conversation per student, reused indefinitely — there's no "start a
  new thread" affordance yet if a counsellor wants to reset context.
- No streaming — the reply appears all at once when the request completes,
  not token-by-token.
- No way to see/attach to *which* student a message was about beyond the tab
  it was opened from (i.e. no cross-student conversation list/search yet).
- Same open items as before: the demo role-switcher security hole is still
  unaddressed, and there's still no CI running the test suites automatically.
