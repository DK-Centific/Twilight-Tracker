#!/usr/bin/env bash
# Serve Project Twilight from this repo (not Kilo / not your home folder).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${1:-8080}"
cd "$ROOT"
if lsof -i ":$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $PORT is already in use. Stop the other server first, then run this again."
  echo "  Example: kill the Python process on port $PORT"
  exit 1
fi
echo "Project Twilight → http://localhost:$PORT/"
echo "Serving from: $ROOT"
exec python3 -m http.server "$PORT"
