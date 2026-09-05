#!/usr/bin/env bash
# Run ONCE on a fresh Ubuntu/Debian Hostinger VPS (as root, or a sudo user) to
# install Docker + the compose plugin and open the firewall for SSH/HTTP/HTTPS.
# Safe to re-run.
set -euo pipefail

echo "==> Installing git..."
if ! command -v git >/dev/null 2>&1; then
  (command -v apt-get >/dev/null 2>&1 && apt-get update -y && apt-get install -y git) || \
    echo "    Couldn't auto-install git — install it manually for your distro."
fi

echo "==> Installing Docker Engine + Compose plugin..."
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

echo "==> Adding $(whoami) to the docker group (log out/in for this to take effect)..."
if [[ "$(id -u)" -ne 0 ]]; then
  sudo usermod -aG docker "$(whoami)"
fi

echo "==> Configuring the firewall (SSH, HTTP, HTTPS only)..."
if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
else
  echo "    ufw not found — skipped. Make sure only 22/80/443 are reachable via your VPS provider's firewall."
fi

echo ""
echo "Done. Next: git clone your repo to /opt/edu-visa on this VPS, then follow DEPLOYMENT.md."
