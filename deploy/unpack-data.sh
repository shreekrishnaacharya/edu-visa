#!/usr/bin/env bash
# Run ON THE SERVER, with sudo, from the directory that holds docker-compose
# (i.e. the project root). Restores the ./docker/ data tree produced by
# deploy/package-data.sh.
#
# WHY sudo AND --numeric-owner: Postgres refuses to start unless its data
# directory is mode 0700 owned by uid 999. Only root can restore that
# ownership, and only --numeric-owner maps it by NUMBER — uid 999 has no name
# in the archive, and if this server happens to have a different user at 999,
# a name-based extract hands the database to the wrong account.
#
# Usage:  sudo ./deploy/unpack-data.sh [docker-data.tar.gz]
set -euo pipefail
cd "$(dirname "$0")/.."

ARCHIVE="${1:-docker-data.tar.gz}"
[ -f "$ARCHIVE" ] || { echo "No such archive: $ARCHIVE" >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || { echo "Run with sudo — see the comment above for why." >&2; exit 1; }

# Refuse to silently merge into live data. Overwriting half a Postgres data
# directory with another one's files does not produce either database.
if [ -d docker/postgres ]; then
  echo "./docker/postgres already exists." >&2
  echo "Refusing to extract over live data. Move it aside first, e.g.:" >&2
  echo "  sudo mv docker docker.bak-\$(date +%F-%H%M)" >&2
  exit 1
fi

echo "==> Extracting $ARCHIVE ..."
tar -xzpf "$ARCHIVE" --numeric-owner

# Verify rather than assume — a wrong owner here shows up later as a Postgres
# crash loop, which is a much worse place to discover it.
OWNER=$(stat -c '%u:%g' docker/postgres)
MODE=$(stat -c '%a' docker/postgres)
echo "==> docker/postgres is $OWNER mode $MODE"
if [ "$OWNER" != "999:999" ] || [ "$MODE" != "700" ]; then
  echo "WRONG: expected 999:999 mode 700. Fixing..." >&2
  chown -R 999:999 docker/postgres
  chmod 700 docker/postgres
  echo "==> now $(stat -c '%u:%g' docker/postgres) mode $(stat -c '%a' docker/postgres)"
fi

echo ""
echo "==> Data restored. Remaining steps (see DEPLOYMENT.md §3):"
echo "  1. server/.env.production must exist, with DB_PASSWORD and PII_ENC_KEY"
echo "     copied EXACTLY from your local server/.env — this archive does not"
echo "     contain them, and the wrong values make the restored data unreadable."
echo "  2. docker compose -f docker-compose.prod.yml --env-file server/.env.production up -d --build"
echo "  3. curl http://localhost:3000/health/ready"
