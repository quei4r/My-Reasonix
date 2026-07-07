# Reasonix Web

A browser-hosted wrapper over the Reasonix kernel. It reuses the `desktop/` React frontend and Go App logic, but runs in a plain browser via an HTTP/SSE server instead of the Wails native shell.

## Quick start

```sh
cd web

# One-shot build + run
./start.sh

# Or manually:
make build    # builds frontend + Go binary
./reasonix-web
```

Then open http://127.0.0.1:8765.

## Development

Build frontend:

```sh
cd web/frontend
pnpm install
pnpm build
```

Build Go backend:

```sh
cd web
CGO_ENABLED=0 go build .
```

Run:

```sh
./reasonix-web
```

## Configuration

- `REASONIX_WEB_ADDR` — bind address (default `127.0.0.1:8765`).
- Uses the same `reasonix.toml` / `~/.reasonix/config.toml` resolution as the CLI.

## Architecture

- `main.go` — entry point, starts the HTTP server.
- `web.go` — HTTP routes: `/api/health`, `/api/call/{method}`, `/api/events`, static files.
- `app.go` — the original desktop App (session/tabs/workspace logic).
- `runtime/` — no-op shim for Wails runtime calls so the App compiles without CGO.
- `frontend/` — React UI from `desktop/frontend`, adapted in `bridge.ts` to talk HTTP.
