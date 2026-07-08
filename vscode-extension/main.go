// Command my-reasonix is a browser-hosted wrapper over the Reasonix kernel.
// It exposes the same desktop App through an HTTP/SSE server so the React frontend
// can run in a plain browser without the Wails native shell.
package main

import (
	"context"
	"embed"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"

	// Blank imports wire compile-time built-ins into their registries, exactly as
	// cmd/reasonix does — boot.Build resolves providers/tools from these registries.
	_ "reasonix/internal/provider/anthropic"
	_ "reasonix/internal/provider/openai"
	"reasonix/internal/sandbox"
	_ "reasonix/internal/tool/builtin"
)

// assets embeds the built frontend. `all:` so dotfiles are included. A real run
// requires `pnpm build` to populate dist.
//
//go:embed all:frontend/dist
var assets embed.FS

var version = "dev"
var channel = "stable"
var macSelfUpdate = "false"

func macSelfUpdateAllowed() bool {
	switch strings.ToLower(strings.TrimSpace(macSelfUpdate)) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

func main() {
	// Route slog output through stdout so the VSCode extension host sees it on
	// the clean [my-reasonix] channel instead of the red [my-reasonix:err] channel.
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, nil)))

	if code, ok := runWindowsSandboxHelperIfRequested(os.Args); ok {
		os.Exit(code)
	}
	sandbox.RegisterHelperDispatch()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	app := NewApp()
	app.startup(ctx)

	handler := newWebServer(app, assets)
	addr := getenv("MY_REASONIX_ADDR", "127.0.0.1:8765")
	srv := &http.Server{Addr: addr, Handler: handler}

	go func() {
		<-ctx.Done()
		_ = srv.Shutdown(context.Background())
	}()

	fmt.Printf("my-reasonix listening on http://%s\n", addr)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		slog.Error("server error", "error", err)
		os.Exit(1)
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func runWindowsSandboxHelperIfRequested(argv []string) (int, bool) {
	if len(argv) > 1 && argv[1] == sandbox.WindowsHelperCommand {
		return sandbox.RunWindowsSandboxHelper(argv[2:], os.Stdin, os.Stdout, os.Stderr), true
	}
	return 0, false
}
