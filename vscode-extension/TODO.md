# Reasonix Web TODO

Goal: create a browser-hosted Reasonix frontend in `web/`, built on top of the shared `internal/` kernel, without modifying `desktop/`.

**Discovery after fresh clone:** upstream `desktop/` is Wails-only. The previous web-mode work existed only on the deleted fork.

Current approach (wrapper layer):
- Keep the entire `desktop/` App logic in `web/`.
- Add `web/runtime/` as a no-op shim for Wails runtime calls.
- Add `web/web.go` HTTP server with:
  - `/api/health`
  - `/api/call/{method}` — reflection RPC into App methods
  - `/api/events` — SSE stream of Wails runtime events (broadcasts to all clients)
  - static file serving for `frontend/dist`
- `web/main.go` starts the HTTP server instead of `wails.Run`.
- `frontend/src/lib/bridge.ts` forces HTTP mode and routes calls/events through the HTTP server.

## Phase 0 — Copy desktop/ to web/ ✅
- [x] Copy `desktop/` to `web/`.
- [x] Rename module to `reasonix/web`.
- [x] Replace `reasonix/desktop` import references.

## Phase 1 — Runtime shim ✅
- [x] Create `web/runtime/` with no-op stubs for Wails runtime functions.
- [x] Replace `github.com/wailsapp/wails/v2/pkg/runtime` imports with `reasonix/web/runtime`.

## Phase 2 — HTTP/SSE wrapper ✅
- [x] Rewrite `main.go` to start HTTP server.
- [x] Implement `/api/health`.
- [x] Implement reflection RPC `/api/call/{method}`.
- [x] Implement SSE `/api/events` with multi-subscriber broadcast.
- [x] Serve static assets.
- [x] `CGO_ENABLED=0 go build .` passes.

## Phase 3 — Frontend bridge to HTTP ✅
- [x] Force `bridge.ts` into HTTP mode (`isHttpMode()` returns true).
- [x] Implement HTTP calls via `/api/call/{method}` using a Proxy.
- [x] Connect SSE event stream to existing event handlers.
- [x] `pnpm install && pnpm build` in `web/frontend` succeeds.
- [x] Server serves built UI and JS assets (200).
- [x] RPC smoke test: `Version` → "dev", `Platform` → "linux".
- [x] SSE smoke test: agent and project-tree events received.

## Phase 4 — End-to-end verification
- [ ] Test session creation and prompt submission through the browser.
- [ ] Verify streamed agent events update the UI.
- [ ] Remove or hide Wails-only UI chrome (title bar controls, tray hooks) if desired.
- [ ] Update `web/README.md` with run/build instructions.

## Notes
- Keep `desktop/` untouched.
- Fail fast: surface internal errors to the browser.
