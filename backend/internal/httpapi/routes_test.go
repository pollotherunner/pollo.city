package httpapi

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"pollo.city/internal/auth"
	"pollo.city/internal/config"
	"pollo.city/internal/store/sqlite"
)

func TestPageRoutes(t *testing.T) {
	pagesDir := t.TempDir()
	writePage(t, pagesDir, "index.html", "index page")
	writePage(t, pagesDir, "admin.html", "admin page")

	database, err := sqlite.New(filepath.Join(t.TempDir(), "pollo.db"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer database.Close()

	cfg := config.Config{
		PublicDir:  pagesDir,
		UploadsDir: t.TempDir(),
		SessionTTL: time.Hour,
	}
	server, err := New(cfg, database, auth.New(database, "password123", time.Hour), slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatalf("create server: %v", err)
	}
	handler := server.Handler()

	tests := []struct {
		name         string
		method       string
		target       string
		status       int
		location     string
		bodyContains string
	}{
		{name: "root", method: http.MethodGet, target: "/", status: http.StatusOK, bodyContains: "index page"},
		{name: "index page", method: http.MethodGet, target: "/index.html", status: http.StatusMovedPermanently, location: "./"},
		{name: "admin clean route", method: http.MethodGet, target: "/admin", status: http.StatusOK, bodyContains: "admin page"},
		{name: "admin clean route with query", method: http.MethodGet, target: "/admin?tab=posts", status: http.StatusOK, bodyContains: "admin page"},
		{name: "admin trailing slash", method: http.MethodGet, target: "/admin/", status: http.StatusMovedPermanently, location: "/admin"},
		{name: "admin trailing slash with query", method: http.MethodGet, target: "/admin/?tab=posts", status: http.StatusMovedPermanently, location: "/admin?tab=posts"},
		{name: "admin legacy html", method: http.MethodGet, target: "/admin.html", status: http.StatusMovedPermanently, location: "/admin"},
		{name: "admin unknown child", method: http.MethodGet, target: "/admin/settings", status: http.StatusNotFound},
		{name: "admin wrong method", method: http.MethodPost, target: "/admin", status: http.StatusMethodNotAllowed},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(test.method, test.target, nil)
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, request)

			if recorder.Code != test.status {
				t.Fatalf("expected status %d, got %d", test.status, recorder.Code)
			}
			if test.location != "" && recorder.Header().Get("Location") != test.location {
				t.Fatalf("expected location %q, got %q", test.location, recorder.Header().Get("Location"))
			}
			if test.bodyContains != "" && !strings.Contains(recorder.Body.String(), test.bodyContains) {
				t.Fatalf("expected body to contain %q, got %q", test.bodyContains, recorder.Body.String())
			}
		})
	}
}

func writePage(t *testing.T, directory, name, body string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(directory, name), []byte(body), 0o644); err != nil {
		t.Fatalf("write page %s: %v", name, err)
	}
}
