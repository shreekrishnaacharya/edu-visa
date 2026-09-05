#!/usr/bin/env bash
# Run LOCALLY, for every CODE update after the first deploy (the first one
# is `git clone` + package-data.sh + DEPLOYMENT.md §2-4 — this script
# assumes the repo is already cloned on the VPS and just pulls + rebuilds).
#
# This never touches ./docker/ on the VPS — code ships via git, data ships
# only via package-data.sh, deliberately kept as two separate actions so a
# routine code push can never accidentally touch live production data.
#
# Usage: ./deploy/deploy.sh user@your-vps-ip [remote-path]
set -euo pipefail

TARGET="${1:?Usage: ./deploy/deploy.sh user@vps-ip [remote-path]}"
REMOTE_PATH="${2:-/opt/edu-visa}"

echo "==> Pulling latest code on $TARGET..."
# shellcheck disable=SC2029
ssh "$TARGET" "cd $REMOTE_PATH && git pull"

echo "==> Building and starting the stack on $TARGET..."
# shellcheck disable=SC2029
ssh "$TARGET" "cd $REMOTE_PATH && \
  test -f server/.env.production || { echo 'Missing server/.env.production on the VPS — see DEPLOYMENT.md.'; exit 1; } && \
  docker compose -f docker-compose.prod.yml --env-file server/.env.production up -d --build"

echo "==> Running database migrations (safe to re-run — no-ops if already applied)..."
# shellcheck disable=SC2029
ssh "$TARGET" "cd $REMOTE_PATH && \
  docker compose -f docker-compose.prod.yml --env-file server/.env.production exec -T api \
  node ./node_modules/typeorm/cli.js migration:run -d dist/config/data-source.js"

echo ""
echo "Done. Check: ssh $TARGET 'cd $REMOTE_PATH && docker compose -f docker-compose.prod.yml logs -f api'"
