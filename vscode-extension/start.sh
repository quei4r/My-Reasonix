#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Clean build artifacts.
if [[ "${1:-}" == "clean" ]]; then
  echo "[start] cleaning..."
  rm -f reasonix-web
  rm -rf frontend/dist
  echo "[start] done"
  exit 0
fi

# Build frontend if dist is missing or stale.
if [[ ! -f frontend/dist/index.html ]] || [[ frontend/src -nt frontend/dist/index.html ]]; then
  echo "[start] building frontend..."
  (cd frontend && pnpm install && pnpm build)
fi

# Build Go binary if missing, if Go source changed, or if frontend dist changed
# (frontend is embedded into the binary at compile time).
if [[ ! -x reasonix-web ]] || [[ $(find . -maxdepth 1 -name '*.go' -newer reasonix-web | wc -l) -gt 0 ]] || [[ frontend/dist -nt reasonix-web ]]; then
  echo "[start] building Go backend..."
  CGO_ENABLED=0 go build -o reasonix-web .
fi

echo "[start] launching reasonix-web on http://127.0.0.1:8765"
exec ./reasonix-web "$@"
