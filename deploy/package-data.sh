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
docker run --rm -v "$(pwd):/repo" -w /repo alpine sh -c "
  tar -czf /repo/$OUT docker &&
  chown $(id -u):$(id -g) /repo/$OUT
"

echo ""
echo "==> Done: $OUT ($(du -h "$OUT" | cut -f1))"
echo ""
echo "Upload it by hand, e.g.:"
echo "  scp $OUT user@your-vps-ip:/opt/edu-visa/"
echo "Then on the VPS, inside the cloned repo (see DEPLOYMENT.md §2):"
echo "  sudo tar -xzf $OUT"
echo "  # sudo matters here — same reason as above: it's what lets ./docker/postgres"
echo "  # come back out owned by uid 999, not whatever your VPS login user is."
