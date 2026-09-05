# Edu-Visa API (NestJS)

The production backend for the student ↔ course matching portal. Australia-first.
Replaces the React prototype's in-browser MSW mocks with a real REST API on
PostgreSQL. See `../docs/PRODUCT_PLAN.md` and
`~/.claude/plans/why-this-project-exist-whimsical-plum.md` for the design.

## Run it

```bash
cp .env.example .env                 # then set PII_ENC_KEY: openssl rand -hex 32
docker compose up -d                 # postgres (pgvector image) + redis + minio
npm install
npm run migration:run                # apply src/migrations/*
npm run seed                          # 8 AU universities, 36 courses, reference
                                     #  tables, 3 demo users, the 15 student fixtures
npm run start:dev                    # http://localhost:3000
```

Demo logins (password `password123`): `admin@edu-visa.local` (super_admin,
carries `visa:read`), `bina.rai@edu-visa.local` (counsellor),
`branch.admin@edu-visa.local` (branch_admin).

Point the frontend at it:

```bash
cd ..
VITE_SERVER_URL=http://localhost:3000 npm run dev
```

(No `VITE_USE_MOCKS` → real API. `VITE_USE_MOCKS=true` → the old MSW build.)

## Layout

- `src/common/` — `PageDto`, `CommonService<T>` (wraps `@sksharma72000/nestjs-search-page`),
  auth guards/decorators, the PII encryption + numeric column transformers, the
  MinIO storage service.
- `src/modules/<aggregate>/` — one folder per aggregate. Entities are normalised
  (one table per Side A / Side B aggregate). `entry_requirement` is a jsonb value
  object on `course` (the one deviation from PRODUCT_PLAN §3); GPA-scale and
  English concordance stay as versioned pure functions in
  `match/engine/reference.ts`, only `fx_rate` is a DB table.
- `src/modules/match/engine/` — `deriveProfile` / `knockout` / `score` /
  `rankCourses`, ported verbatim from the prototype's `src/mocks/engine/*` and
  pinned by `test/engine-golden.spec.ts` (`npm test`). Two knockout rules the
  prototype lacked (unmet prerequisite, no open intake in the planning window)
  are added and marked.
- `src/modules/assistant/` — scaffold only. `Conversation` / `Message` tables and
  `POST /assistant/messages` returning a stub. The attachment point for the
  chat/RAG phase; no LLM is wired.

## Key endpoints

| Method | Path | Notes |
|---|---|---|
| `POST` | `/auth/login`, `/auth/token` | JWT access + refresh |
| `GET` | `/students` | branch/counsellor-scoped from the token; each row embeds the latest `student_profile` |
| `GET` | `/students/:id` | nested aggregate + embedded `profile`; `visa_history` stripped unless caller has `visa:read`; financial/visa reads are audit-logged |
| `POST`/`PATCH` | `/students`, `/students/:id` | nested writes in one call; re-derives + versions the profile |
| `GET` | `/students/:id/profile`, `/students/:id/match-runs/latest` | |
| `POST` | `/match/runs` | run engine, persist a `MatchRun` |
| `POST` | `/match/preview` | run engine, **no persist** (powers the live weight sliders) |
| `GET` | `/courses`, `/universities` | list/search (`_start/_end/_sort/_order` → `{elements,totalElements,pageable}`); mutations are `super_admin` only |
| `POST` | `/courses/import` | CRICOS-style CSV importer (`?dryRun=true` by default) |
| `GET`/`POST`/`DELETE` | `/documents`, `/follow-ups` | documents go to S3/MinIO with presigned URLs |
| `POST` | `/knowledge/ingest` | fetch + embed + index a URL into the RAG knowledge base (`super_admin`) |
| `POST` | `/knowledge/search` | debug hybrid retrieval directly |
| `POST` | `/assistant/messages` | the AI consultant — grounded, cited, OpenRouter + the KB |

API docs (Swagger): `/docs` once the server is running.

## Production hardening

- **Rate limiting** — Redis-backed (`@nestjs/throttler` + `@nest-lab/throttler-storage-redis`), global default in `.env` (`THROTTLE_LIMIT`/`THROTTLE_TTL_MS`), a tighter cap on `/auth/login` (`THROTTLE_AUTH_LIMIT`).
- **Consistent error envelope** — `AllExceptionsFilter` (`{statusCode, error, message, path, timestamp}` on every error, no leaked stack traces; 5xx are server-logged).
- **Request logging** — one line per request (method/path/status/ms/caller) via `LoggingInterceptor`.
- **Health**: `/health` (liveness) vs `/health/ready` (liveness **and** the DB is actually reachable — use this one for load-balancer/orchestrator readiness gates).
- **Real login** — the frontend now has an actual sign-in screen (`src/modules/@auth/login.tsx`) gating every route via `<Authenticated>`; `authProvider.check()` no longer silently signs a visitor in. The top-bar role switch still re-authenticates as a seeded demo account for convenience in this environment — **remove or permission-gate that before a real production launch**.
- **Containerized**: `Dockerfile` (multi-stage, non-root, healthcheck). `docker compose up -d` still starts only the infra (db/redis/minio) for local `npm run start:dev`; `docker compose --profile full up -d --build` runs the whole stack, API included.
- AI model choice and the spend floor are `.env`-driven (`OPENROUTER_CHAT_MODEL` / `_FALLBACK` / `_MIN_BALANCE_USD`), not hardcoded.

## Real course catalogue

The synthetic 36-course catalogue has been replaced with the **real
Australian Government CRICOS register** (data.gov.au) — 3,508 real courses
across the same 8 universities, with real published tuition fees. See
`data/cricos/README.md` for provenance, scope, and the known data quirks it
handles (joint-degree $0/$1 fee artifacts; entry requirements aren't in
CRICOS data, so they're documented estimated defaults).

## Notes

- Docker Hub was unreachable in the environment this was built in, so it was
  verified against a local Postgres 18 from the `embedded-postgres` npm package
  (not a dependency — `docker compose` is the supported path). Migration, seed,
  boot, auth, tenancy, the match flow, profile versioning, the catalogue filters,
  visa gating + audit, and the golden engine test all pass.
- `npm run seed` compiles via `tsconfig.seed.json` because it imports the
  frontend's ESM fixture files (`../frontend/src/mocks/db/*`) so intake dates stay fresh.
