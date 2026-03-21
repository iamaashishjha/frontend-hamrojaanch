#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════
# HamroJaanch Frontend — Start Dev Server (Linux / macOS / Git Bash)
# Usage: bash run.sh [--skip]
#   --skip  Skip npm install, start server directly
# ═══════════════════════════════════════════════════════
set -e
cd "$(dirname "$0")"

echo "═══════════════════════════════════════"
echo "  HamroJaanch Frontend"
echo "═══════════════════════════════════════"
echo ""

# ── Create .env from example if missing ──
if [ ! -f .env ] && [ -f .env.example ]; then
  echo "[env] Creating .env from .env.example..."
  cp .env.example .env
fi

# ── Install dependencies unless --skip ──
if [ "$1" != "--skip" ]; then
  echo "[npm] Installing dependencies..."
  npm install
  echo ""
fi

echo "[vite] Starting dev server on http://localhost:8080"
echo "       Press Ctrl+C to stop."
echo ""
npx vite --host
