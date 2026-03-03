#!/bin/bash
# ── CODE Mobile — Deploy to Production ──────────────────────────
# Pulls latest code, rebuilds Docker image, and restarts the service.
#
# Usage:
#   ./scripts/deploy.sh                    # uses DEPLOY_HOST env or prompts
#   ./scripts/deploy.sh user@1.2.3.4      # explicit SSH target
#   DEPLOY_HOST=codemobile@1.2.3.4 ./scripts/deploy.sh
#
# The script runs on your local machine and SSHs into the server.
# Requires SSH key-based authentication to the server.

set -euo pipefail

# ── Resolve SSH target ──────────────────────────────────────────
TARGET="${1:-${DEPLOY_HOST:-}}"

if [ -z "$TARGET" ]; then
  echo "Usage: ./scripts/deploy.sh [user@host]"
  echo "  or:  DEPLOY_HOST=codemobile@1.2.3.4 ./scripts/deploy.sh"
  exit 1
fi

echo "═══════════════════════════════════════════════════"
echo "  CODE Mobile — Deploying to $TARGET"
echo "═══════════════════════════════════════════════════"
echo ""

# ── Deploy via SSH ──────────────────────────────────────────────
ssh -o ConnectTimeout=10 "$TARGET" bash -s <<'REMOTE_SCRIPT'
set -euo pipefail

cd ~/code-mobile || { echo "ERROR: ~/code-mobile not found"; exit 1; }

echo "[1/4] Pulling latest code..."
git pull origin main

echo "[2/4] Building Docker image..."
docker compose -f docker/docker-compose.yml build --no-cache

echo "[3/4] Restarting service..."
docker compose -f docker/docker-compose.yml up -d

echo "[4/4] Running health check..."
sleep 5

if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
  echo ""
  echo "══════════════════════════════════════"
  echo "  Deploy OK"
  HEALTH=$(curl -sf http://localhost:3000/health)
  echo "  $HEALTH"
  echo "══════════════════════════════════════"
else
  echo ""
  echo "══════════════════════════════════════"
  echo "  Deploy FAILED — health check failed"
  echo "  Check logs: docker compose -f docker/docker-compose.yml logs --tail=50"
  echo "══════════════════════════════════════"
  exit 1
fi
REMOTE_SCRIPT

echo ""
echo "Deploy complete."
