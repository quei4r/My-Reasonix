#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Clean build artifacts.
if [[ "${1:-}" == "clean" ]]; then
  echo "[start] cleaning..."
  rm -f my-reasonix
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
if [[ ! -x my-reasonix ]] || [[ $(find . -maxdepth 1 -name '*.go' -newer my-reasonix | wc -l) -gt 0 ]] || [[ frontend/dist -nt my-reasonix ]]; then
  echo "[start] building Go backend..."
  CGO_ENABLED=0 go build -o my-reasonix .
fi

echo "[start] launching my-reasonix on http://127.0.0.1:8765"
exec ./my-reasonix "$@"
