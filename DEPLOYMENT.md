# Deploying edu-visa to a Hostinger VPS

Two separate things ship separately, on purpose:

- **Code** → git (push to a remote, clone/pull on the VPS).
- **Data** → `./docker/` (Postgres incl. the pgvector knowledge base, Redis,
  MinIO — bind-mounted plain folders, not opaque Docker volumes, and
  gitignored) → packaged into one tarball and uploaded by hand.

Keeping them separate means a routine code push can never accidentally
touch live production data, and the data transfer is a deliberate,
one-off (or occasional) action you take on purpose.

This was verified locally end-to-end before writing this doc — not just
built, actually run: both `server/Dockerfile` and `frontend/Dockerfile`
build clean; `deploy/package-data.sh` produced a real tarball; that tarball
was extracted into a completely fresh, empty directory with `./docker/postgres`
coming back out with the exact ownership (`999:999`, mode `700`) Postgres
requires; the full stack was brought up from that fresh copy; and a real
authenticated API call against it returned the actual 3,508-course
catalogue. Three real bugs were caught and fixed doing that (see "What this
caught" at the bottom).

**One thing worth knowing up front**: `./docker/postgres` must be mode
`0700` owned by Postgres's own internal uid (999) — Postgres refuses to
start otherwise. That means *your own shell user cannot read into it* (a
plain `ls` on it fails with "Permission denied"). A plain `zip` run as
yourself would silently produce an archive **missing the database
entirely** — not an error, just quietly wrong. `deploy/package-data.sh`
handles this correctly (packages via a throwaway root container instead of
your shell user) — use it rather than zipping `docker/` by hand.

## 0. What's in this repo for this

| File | Purpose |
|---|---|
| `docker-compose.prod.yml` | The full stack: db, redis, minio, api, web, Caddy (reverse proxy + auto‑TLS). |
| `Caddyfile` | Reverse proxy routing + automatic Let's Encrypt HTTPS. |
| `frontend/Dockerfile`, `frontend/nginx.conf` | Static build served by nginx. |
| `server/Dockerfile` | Already existed; builds the NestJS API. |
| `server/.env.production.example` | Template — copy to `server/.env.production` on the VPS. |
| `./docker/` | **The real data** — Postgres (incl. pgvector KB), Redis, MinIO. Gitignored; travels only as a packaged tarball, never git. |
| `deploy/bootstrap-vps.sh` | Run once on a fresh VPS — installs git, Docker, opens the firewall. |
| `deploy/package-data.sh` | Run locally, whenever you need to ship data — packages `./docker/` into a tarball (see the permission note above for why this exists instead of a plain zip). |
| `deploy/deploy.sh` | Run for every *code* update after the first — `git pull` + rebuild on the VPS. Never touches `./docker/`. |

## 1. One-time: prepare the VPS

SSH into the fresh Hostinger VPS and run:

```bash
scp deploy/bootstrap-vps.sh user@your-vps-ip:~
ssh user@your-vps-ip 'bash bootstrap-vps.sh'
```

This installs git, Docker + the compose plugin, and opens only 22/80/443 in
the firewall. Log out and back in once (the docker-group membership needs a
fresh shell).

**Domain (recommended before going further):** point two DNS A records at
the VPS's IP — e.g. `app.yourdomain.com` and `api.yourdomain.com` — so Caddy
can issue real HTTPS certificates automatically. Real student passport
numbers and financial data flow through this app; don't run it long-term
over plain HTTP. Edit `Caddyfile` and replace the two placeholder domains
with your real ones.

No domain yet? See the commented-out fallback block at the bottom of
`Caddyfile` — serves plain HTTP on the bare IP so you can smoke-test first
and add the domain later.

## 2. One-time: ship the code (git) and the data (manual upload)

**Code**, from your local machine — push it somewhere the VPS can pull from.
No remote is configured yet in this repo, so pick one:

```bash
# Option A: a hosted remote (GitHub/GitLab/etc.) — most common
git remote add origin git@github.com:you/edu-visa.git
git add -A   # review with `git status` first — see §6 on the two files
             # already flagged for exclusion
git commit -m "Production deploy setup"
git push -u origin main
```

Then on the VPS:

```bash
ssh user@your-vps-ip
git clone git@github.com:you/edu-visa.git /opt/edu-visa
# (if the VPS needs its own deploy key/access to your remote, set that up
#  the normal way for whichever host you chose)
```

No third-party git host wanted? Push straight to a bare repo on the VPS
itself instead:

```bash
# once, on the VPS:
mkdir -p /opt/edu-visa.git && cd /opt/edu-visa.git && git init --bare
git config receive.denyCurrentBranch updateInstead   # lets a push update the working tree directly
mkdir -p /opt/edu-visa && git --git-dir=/opt/edu-visa.git --work-tree=/opt/edu-visa checkout main -f

# once, locally:
git remote add vps ssh://user@your-vps-ip/opt/edu-visa.git
git push vps main
```

**Data**, from your local machine:

```bash
./deploy/package-data.sh
```

Stops your local stack (so `./docker/` isn't captured mid-write), then
packages just that folder into `docker-data.tar.gz`. Upload and extract it
inside the cloned repo on the VPS:

```bash
scp docker-data.tar.gz user@your-vps-ip:/opt/edu-visa/
ssh user@your-vps-ip 'cd /opt/edu-visa && sudo tar -xzf docker-data.tar.gz && rm docker-data.tar.gz'
```

Extract with `sudo` (or as root) — same reason as the permission note above:
that's what lets `./docker/postgres` come back out owned by uid 999 instead
of whatever your VPS login user happens to be.

Then restart your local stack for continued dev work: `docker compose -f
server/docker-compose.yml up -d`.

## 3. One-time: fill in the production env file — ON THE VPS

```bash
ssh user@your-vps-ip
cd /opt/edu-visa
cp server/.env.production.example server/.env.production
nano server/.env.production
```

Fill in (see the comments in the file for which are safe to generate fresh
vs. which **must** match your local `server/.env` exactly — the Postgres
password and the PII encryption key both fall in the second group, because
real encrypted data already exists under `./docker/postgres`):

- `CORS_ORIGIN` → your frontend's real domain (e.g. `https://app.yourdomain.com`)
- `DB_PASSWORD` → copy from local `server/.env` (do not regenerate — see the file's comment)
- `PII_ENC_KEY` → copy from local `server/.env` (do not regenerate — see the file's comment)
- `JWT_SECRET` → generate fresh: `openssl rand -hex 32`
- `S3_SECRET_KEY` → generate fresh or copy from local, either is fine
- `OPENROUTER_API_KEY` → copy from local `server/.env`

Also set `VITE_SERVER_URL` for the frontend build — put it in a root `.env`
next to `docker-compose.prod.yml`:

```bash
echo "VITE_SERVER_URL=https://api.yourdomain.com" > .env
```

## 4. Bring it up

```bash
docker compose -f docker-compose.prod.yml --env-file server/.env.production up -d --build
```

Since `./docker/postgres` already has the full schema and real data, you do
**not** need to run migrations or seed on this first boot. Migrations only
matter for future code updates that add new ones — `deploy/deploy.sh`
(§5) already runs `migration:run` after every redeploy (a no-op if there's
nothing new to apply).

Verify:

```bash
curl https://api.yourdomain.com/health/ready
# {"status":"ready","db":"ok",...}

curl -X POST https://api.yourdomain.com/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"bina.rai@edu-visa.local","password":"password123"}'
# a real access_token back
```

Open `https://app.yourdomain.com` in a browser and log in.

## 5. Every code update after the first

```bash
./deploy/deploy.sh user@your-vps-ip /opt/edu-visa
```

`git pull`s on the VPS, rebuilds, restarts, and runs any new migrations.
Never touches `./docker/` — that's live production data by now (real
students, not your local dev data), so it's excluded on principle, not just
by accident. Need to push a local data change to production later? That's a
separate, deliberate action — run `deploy/package-data.sh` again and upload
it again, or `pg_dump`/`pg_restore` between the two — never automatic.

## 6. Before you send this to real students — a short checklist

- **`server/.env` and `frontend/.env` were previously committed to this
  repo's git history** (commit `69d2473`) — untracked going forward
  (`.gitignore` added), but **you're about to push this repo to a remote
  for the first time** (§2), which is exactly the moment those old secret
  values (OpenRouter key, JWT secret, PII key, DB password) stop being
  merely "in local history" and start being "on GitHub/GitLab history."
  Rotate them before or right after that push, not after.
- **The demo role-switcher is still live** (one click becomes any role,
  no real check) — a real security hole if left in a public build. Flagged
  in earlier session notes, intentionally not fixed yet; fix or gate it
  behind a build flag before real traffic.
- **Default demo passwords** (`password123` for the seeded admin/counsellor
  accounts) — rotate them before this is reachable by anyone outside the team.
- **The `STUDENT VISA checklist(.7z)` at the repo root is also already
  committed to git** — real past-client PII (names, family, financial
  details) explicitly kept out of scope for this app. It has nothing to do
  with anything here; if you push this repo to a remote (§2), decide
  deliberately whether that comes along — it isn't excluded by `.gitignore`
  today, only from the deploy scripts.
- HTTPS via the domain path (§1), not the no-domain fallback, before real
  PII flows through it.
- `docker/` is a real backup of your data by construction — but it's the
  *only* copy once the VPS is the source of truth going forward. Consider a
  periodic `docker compose -f docker-compose.prod.yml exec db pg_dump ...`
  cron to a separate location once the VPS is live and being written to.

## What this caught (verified, not assumed)

Building this meant actually running the full stack end-to-end locally
first — including a full package → extract-to-a-fresh-directory → boot
round trip — which surfaced three real, pre-existing bugs none of which had
ever been exercised before (Docker Hub had been unreachable earlier in the
project, so the containerized build was never actually run):

1. **`axios`** (used by `OpenRouterService` for every OpenRouter call) was
   declared as a `devDependency`, not a real one — `npm ci --omit=dev` in
   the production image stripped it, and the container crashed on boot with
   `Cannot find module 'axios'`. Moved to `dependencies`.
2. **`frontend/.npmrc`** sets `legacy-peer-deps=true` (there's a real
   `@refinedev/cli`/`@refinedev/devtools` peer-version conflict) — the
   Dockerfile's `npm ci` ran before that file was copied in, so the
   container build failed with `ERESOLVE`. Fixed by copying `.npmrc`
   alongside `package.json` before installing.
3. **`./docker/postgres` is unreadable by a normal shell user** (Postgres
   requires it mode `0700` owned by its own uid) — a plain `zip` as
   yourself would silently ship an archive with the database missing. Fixed
   by packaging (and, on the VPS side, extracting) as root via a throwaway
   container/`sudo` instead of your own user — see `deploy/package-data.sh`.

All three are now fixed and the full stack (frontend + backend,
containerized, against the real migrated data, extracted from an actual
packaged tarball into a brand-new directory) is confirmed working locally
before this doc claims it will work on the VPS.
