// Package runtime is a web-only compatibility shim for the Wails runtime package.
// It lets the desktop App compile and run in browser-hosted mode by no-op'ing the
// native window/dialog/file-drop calls that have no browser equivalent.
package runtime

import (
	"context"
	"sync"
)

// EventSubscriber receives events that would otherwise be emitted to the Wails
// runtime. The web server registers one subscriber per active SSE connection.
type EventSubscriber interface {
	Emit(eventName string, data ...any)
}

var (
	eventSubscribers   = map[EventSubscriber]struct{}{}
	eventSubscribersMu sync.RWMutex
)

// RegisterEventSubscriber adds a subscriber that will receive all runtime events.
func RegisterEventSubscriber(s EventSubscriber) {
	eventSubscribersMu.Lock()
	defer eventSubscribersMu.Unlock()
	eventSubscribers[s] = struct{}{}
}

// UnregisterEventSubscriber removes a subscriber.
func UnregisterEventSubscriber(s EventSubscriber) {
	eventSubscribersMu.Lock()
	defer eventSubscribersMu.Unlock()
	delete(eventSubscribers, s)
}

// DialogType mirrors runtime.DialogType.
type DialogType int

const (
	QuestionDialog DialogType = iota
	WarningDialog
)

// FileFilter mirrors runtime.FileFilter.
type FileFilter struct {
	DisplayName string
	Pattern     string
}

// OpenDialogOptions mirrors runtime.OpenDialogOptions.
type OpenDialogOptions struct {
	Title            string
	DefaultDirectory string
}

// SaveDialogOptions mirrors runtime.SaveDialogOptions.
type SaveDialogOptions struct {
	Title                string
	DefaultDirectory     string
	DefaultFilename      string
	CanCreateDirectories bool
	Filters              []FileFilter
}

// MessageDialogOptions mirrors runtime.MessageDialogOptions.
type MessageDialogOptions struct {
	Type          DialogType
	Title         string
	Message       string
	Buttons       []string
	DefaultButton string
	CancelButton  string
}

// EventsEmit forwards to all registered subscribers.
func EventsEmit(ctx context.Context, eventName string, data ...any) {
	eventSubscribersMu.RLock()
	subs := make([]EventSubscriber, 0, len(eventSubscribers))
	for s := range eventSubscribers {
		subs = append(subs, s)
	}
	eventSubscribersMu.RUnlock()
	for _, s := range subs {
		s.Emit(eventName, data...)
	}
}

// BrowserOpenURL is a no-op in web mode.
func BrowserOpenURL(ctx context.Context, url string) {}

// OpenDirectoryDialog is unsupported in web mode.
func OpenDirectoryDialog(ctx context.Context, opts OpenDialogOptions) (string, error) {
	return "", nil
}

// SaveFileDialog is unsupported in web mode.
func SaveFileDialog(ctx context.Context, opts SaveDialogOptions) (string, error) {
	return "", nil
}

// MessageDialog is unsupported in web mode.
func MessageDialog(ctx context.Context, opts MessageDialogOptions) (string, error) {
	return "", nil
}

// OnFileDrop is a no-op in web mode.
func OnFileDrop(ctx context.Context, cb func(x, y int, paths []string)) {}

// WindowIsMaximised always returns false in web mode.
func WindowIsMaximised(ctx context.Context) bool { return false }

// WindowMinimise is a no-op in web mode.
func WindowMinimise(ctx context.Context) {}

// WindowMaximise is a no-op in web mode.
func WindowMaximise(ctx context.Context) {}

// WindowShow is a no-op in web mode.
func WindowShow(ctx context.Context) {}

// WindowHide is a no-op in web mode.
func WindowHide(ctx context.Context) {}

// WindowUnminimise is a no-op in web mode.
func WindowUnminimise(ctx context.Context) {}

// WindowSetPosition is a no-op in web mode.
func WindowSetPosition(ctx context.Context, x, y int) {}

// WindowCenter is a no-op in web mode.
func WindowCenter(ctx context.Context) {}

// Quit is a no-op in web mode.
func Quit(ctx context.Context) {}

// Hide is a no-op in web mode.
func Hide(ctx context.Context) {}

// Show is a no-op in web mode.
func Show(ctx context.Context) {}

// WindowToggleMaximise is a no-op in web mode.
func WindowToggleMaximise(ctx context.Context) {}

// WindowGetSize returns zero size in web mode.
func WindowGetSize(ctx context.Context) (int, int) { return 0, 0 }

// WindowGetPosition returns zero position in web mode.
func WindowGetPosition(ctx context.Context) (int, int) { return 0, 0 }

// ScreenGetAll is unsupported in web mode.
func ScreenGetAll(ctx context.Context) ([]Screen, error) { return nil, nil }

// WindowExecJS is a no-op in web mode.
func WindowExecJS(ctx context.Context, js string) {}

// Screen mirrors a subset of runtime.Screen.
type Screen struct {
	Size struct {
		Width  int
		Height int
	}
}
