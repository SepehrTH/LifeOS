#!/bin/bash
# Runs the production server. Used by the LaunchAgent and by `npm run serve`.
set -euo pipefail

cd "$(dirname "$0")/.."

PORT="${PORT:-3000}"
HOST="${HOST:-127.0.0.1}"   # localhost only — never exposed to the network

if [ ! -f .next/BUILD_ID ]; then
  echo "[lifeos] no production build found, building…"
  node ./node_modules/next/dist/bin/next build
fi

echo "[lifeos] starting on http://$HOST:$PORT"
exec node ./node_modules/next/dist/bin/next start -H "$HOST" -p "$PORT"
