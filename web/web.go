package main

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"net/http"
	"reflect"
	"strings"
	"sync"
	"time"

	webRuntime "reasonix/web/runtime"
)

// newWebServer creates the HTTP handler that wraps the App for browser access.
func newWebServer(app *App, assets embed.FS) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "version": version})
	})

	mux.HandleFunc("/api/call/{method}", handleRPC(app))
	mux.HandleFunc("/api/events", handleEvents(app))

	// Wrap mux to log every incoming request.
	wrap := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		slog.Info("[web] request", "method", r.Method, "path", r.URL.Path, "remote", r.RemoteAddr, "ua", r.UserAgent())
		mux.ServeHTTP(w, r)
		slog.Info("[web] response", "method", r.Method, "path", r.URL.Path, "status", "done", "elapsed", time.Since(start).String())
	})

	staticFS, err := fs.Sub(assets, "frontend/dist")
	if err != nil {
		slog.Warn("frontend/dist not found; UI will not be served", "error", err)
		staticFS, _ = fs.Sub(assets, ".")
	}
	mux.Handle("/", spaHandler(http.FS(staticFS)))

	return wrap
}

func handleRPC(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		methodName := r.PathValue("method")
		if methodName == "" {
			http.Error(w, "method required", http.StatusBadRequest)
			return
		}

		methodName = strings.ToUpper(methodName[:1]) + methodName[1:]
		method := reflect.ValueOf(app).MethodByName(methodName)
		if !method.IsValid() {
			writeJSON(w, http.StatusNotFound, map[string]any{"error": "unknown method " + methodName})
			return
		}

		mt := method.Type()
		params := make([]json.RawMessage, mt.NumIn())
		if mt.NumIn() > 0 {
			body, err := io.ReadAll(r.Body)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
				return
			}
			if len(body) > 0 {
				if err := json.Unmarshal(body, &params); err != nil {
					writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
					return
				}
			}
		}

		args := make([]reflect.Value, mt.NumIn())
		for i := 0; i < mt.NumIn(); i++ {
			if i >= len(params) {
				args[i] = reflect.Zero(mt.In(i))
				continue
			}
			v, err := decodeParam(params[i], mt.In(i))
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": fmt.Sprintf("param %d: %v", i, err)})
				return
			}
			args[i] = v
		}

		results := method.Call(args)
		resp := map[string]any{}
		if len(results) > 0 {
			last := results[len(results)-1]
			if last.Type().Implements(reflect.TypeOf((*error)(nil)).Elem()) && !last.IsNil() {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": last.Interface().(error).Error()})
				return
			}
			if len(results) == 1 {
				resp["result"] = results[0].Interface()
			} else {
				resp["result"] = results[0].Interface()
			}
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

func decodeParam(raw json.RawMessage, t reflect.Type) (reflect.Value, error) {
	if t.Kind() == reflect.String {
		var s string
		if err := json.Unmarshal(raw, &s); err != nil {
			return reflect.Value{}, err
		}
		return reflect.ValueOf(s), nil
	}
	if t.Kind() == reflect.Int {
		var n int
		if err := json.Unmarshal(raw, &n); err != nil {
			return reflect.Value{}, err
		}
		return reflect.ValueOf(n), nil
	}
	if t.Kind() == reflect.Bool {
		var b bool
		if err := json.Unmarshal(raw, &b); err != nil {
			return reflect.Value{}, err
		}
		return reflect.ValueOf(b), nil
	}
	if t.Kind() == reflect.Ptr {
		if t.Elem().Kind() == reflect.String {
			var s string
			if err := json.Unmarshal(raw, &s); err != nil {
				return reflect.Value{}, err
			}
			return reflect.ValueOf(&s), nil
		}
	}
	if t.Kind() == reflect.Slice && t.Elem().Kind() == reflect.Uint8 {
		var b []byte
		if err := json.Unmarshal(raw, &b); err != nil {
			return reflect.Value{}, err
		}
		return reflect.ValueOf(b), nil
	}

	// Fallback: unmarshal into the target type via JSON.
	v := reflect.New(t)
	if err := json.Unmarshal(raw, v.Interface()); err != nil {
		return reflect.Value{}, err
	}
	return v.Elem(), nil
}

func handleEvents(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming unsupported", http.StatusInternalServerError)
			return
		}

		sink := newSSESink(w, flusher, r.Context())
		webRuntime.RegisterEventSubscriber(sink)
		defer func() {
			webRuntime.UnregisterEventSubscriber(sink)
			sink.Close()
		}()

		<-r.Context().Done()
	}
}

type sseSink struct {
	w     io.Writer
	flush http.Flusher
	done  chan struct{}
	once  sync.Once
	ctx   context.Context
	mu    sync.Mutex
	wg    sync.WaitGroup
}

func newSSESink(w io.Writer, flush http.Flusher, ctx context.Context) *sseSink {
	return &sseSink{w: w, flush: flush, done: make(chan struct{}), ctx: ctx}
}

func (s *sseSink) Emit(name string, data ...any) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.wg.Add(1)
	defer s.wg.Done()

	select {
	case <-s.done:
		return
	default:
	}
	if s.ctx != nil && s.ctx.Err() != nil {
		return
	}
	payload, _ := json.Marshal(map[string]any{"name": name, "data": data})
	_, wErr := fmt.Fprintf(s.w, "data: %s\n\n", payload)
	s.flush.Flush()
	if wErr != nil {
		select {
		case <-s.done:
		default:
			s.once.Do(func() { close(s.done) })
		}
	}
}

func (s *sseSink) Close() {
	s.once.Do(func() { close(s.done) })
	s.wg.Wait()
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("failed to encode JSON response", "error", err)
	}
}

func spaHandler(fs http.FileSystem) http.Handler {
	fileServer := http.FileServer(fs)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if path != "/" && !strings.Contains(path, ".") {
			r.URL.Path = "/"
		}
		// The root index.html must never be cached: each build produces a new
		// set of content-hashed chunk URLs, and a cached old HTML would point
		// JS/CSS bundles that no longer exist on disk.
		if path == "/" || r.URL.Path == "/" {
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			w.Header().Set("Pragma", "no-cache")
		}
		fileServer.ServeHTTP(w, r)
	})
}
