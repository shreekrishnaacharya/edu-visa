#!/usr/bin/env bash
# Run LOCALLY. Code ships via git — this handles the other half: packaging
# ONLY ./docker/ (Postgres incl. the pgvector KB, Redis, MinIO — the real
# data, not tracked in git) into one tarball to upload by hand.
#
# WHY NOT A PLAIN `zip`: Postgres requires its data directory to be mode
# 0700 owned by its own internal uid (999) — your shell user cannot read
# into ./docker/postgres at all (verified: `ls` on it fails with "Permission
# denied"). A plain zip run as yourself would silently produce an archive
# with the database missing, not an error you'd notice until the app came up
# empty on the other end. This runs the tar step INSIDE a throwaway
# container instead, where root can read it correctly.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="${1:-docker-data.tar.gz}"

echo "==> Stopping the local stack (so ./docker/ isn't captured mid-write)..."
docker compose -f server/docker-compose.yml --profile full stop

echo "==> Packaging ./docker/ (runs as root inside a container — see comment above for why)..."
# --numeric-owner: record uid/gid as numbers. Postgres's uid 999 has no name
# inside the container, and the VPS may well have a DIFFERENT user at 999 —
# extracting by name is how the data directory ends up owned by the wrong
# account and Postgres refuses to start.
docker run --rm -v "$(pwd):/repo" -w /repo alpine sh -c "
  tar -czf /repo/$OUT --numeric-owner docker &&
  chown $(id -u):$(id -g) /repo/$OUT
"

# VERIFY, do not assume. The whole reason this script exists is that a plain
# zip silently omits docker/postgres; an unverified tar can fail the same way
# (a stray permission change, a wrong working directory). Check the archive
# really contains the database, and that it carries uid 999 — before the
# tarball is trusted enough to upload.
echo "==> Verifying the archive actually contains the database..."
# The listing goes to a file and the greps read that file. Piping tar into
# `grep -q` instead looks correct and is not: grep exits at the first match,
# tar takes SIGPIPE, and under `set -o pipefail` a SUCCESSFUL match is reported
# as a failed pipeline — which is precisely backwards for a safety check.
LIST=$(mktemp)
trap 'rm -f "$LIST"' EXIT
tar -tvzf "$OUT" --numeric-owner > "$LIST"

PGFILES=$(grep -c ' docker/postgres/' "$LIST" || true)
if [ "$PGFILES" -lt 100 ]; then
  echo "FAILED: only $PGFILES file(s) under docker/postgres/ in $OUT." >&2
  echo "The database did not make it in. Do NOT upload this archive." >&2
  rm -f "$OUT"
  exit 1
fi
if ! grep -qE '^drwx------ 999/999 .* docker/postgres/$' "$LIST"; then
  echo "FAILED: docker/postgres is not recorded as mode 0700 owned by uid 999." >&2
  echo "Postgres would refuse to start from this archive. Do NOT upload it." >&2
  rm -f "$OUT"
  exit 1
fi
echo "    ok — $PGFILES database files, docker/postgres recorded as 999:999 mode 0700"

echo ""
echo "==> Done: $OUT ($(du -h "$OUT" | cut -f1))"
echo ""
echo "Upload it by hand, e.g.:"
echo "  scp $OUT user@your-vps-ip:/opt/edu-visa/"
echo "Then on the VPS, in the project root:"
echo "  sudo ./deploy/unpack-data.sh $OUT"
echo ""
echo "  # That script extracts with sudo + --numeric-owner and then CHECKS the"
echo "  # result, which is what gets ./docker/postgres back as uid 999 mode 0700"
echo "  # instead of your VPS login user. If you would rather do it by hand:"
echo "  #   sudo tar -xzpf $OUT --numeric-owner"
echo "  # Either way server/.env.production must carry the same DB_PASSWORD and"
echo "  # PII_ENC_KEY as your local server/.env — they are NOT in this archive."
