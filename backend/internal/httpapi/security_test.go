package httpapi

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"pollo.city/internal/auth"
	"pollo.city/internal/config"
	"pollo.city/internal/store/sqlite"
)

func newSecurityTestServer(t *testing.T, cfg config.Config) (http.Handler, func()) {
	t.Helper()
	database, err := sqlite.New(filepath.Join(t.TempDir(), "pollo.db"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	cfg.PublicDir = t.TempDir()
	cfg.UploadsDir = t.TempDir()
	if cfg.SessionTTL == 0 {
		cfg.SessionTTL = time.Hour
	}
	server, err := New(cfg, database, auth.New(database, "password123", cfg.SessionTTL), slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		database.Close()
		t.Fatalf("create server: %v", err)
	}
	return server.Handler(), func() { database.Close() }
}

func TestLoginRateLimit(t *testing.T) {
	handler, closeStore := newSecurityTestServer(t, config.Config{LoginRateLimit: 1, LoginRateWindow: time.Hour})
	defer closeStore()

	send := func() *httptest.ResponseRecorder {
		request := httptest.NewRequest(http.MethodPost, "/api/admin/login", strings.NewReader(`{"password":"errada"}`))
		request.RemoteAddr = "203.0.113.10:1234"
		request.Header.Set("Content-Type", "application/json")
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, request)
		return recorder
	}

	if recorder := send(); recorder.Code != http.StatusUnauthorized {
		t.Fatalf("first login status: %d", recorder.Code)
	}
	limited := send()
	if limited.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d", limited.Code)
	}
	if limited.Header().Get("Retry-After") == "" {
		t.Fatal("rate limited login is missing Retry-After")
	}
}

func TestCrossOriginMutationIsBlocked(t *testing.T) {
	handler, closeStore := newSecurityTestServer(t, config.Config{})
	defer closeStore()

	request := httptest.NewRequest(http.MethodPost, "/api/admin/login", strings.NewReader(`{"password":"password123"}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Origin", "https://evil.example")
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", recorder.Code)
	}
}

func TestPostRejectsMissingUploadReference(t *testing.T) {
	handler, closeStore := newSecurityTestServer(t, config.Config{})
	defer closeStore()

	cookie := loginCookie(t, handler)
	body := `{"title":"Artigo","excerpt":"","tags":[],"thumbnail":"/uploads/00000000000000000000000000000001.png","body":"Conteúdo","section":"article","audio":""}`
	request := httptest.NewRequest(http.MethodPost, "/api/admin/posts", strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	request.AddCookie(cookie)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "uploaded file not found") {
		t.Fatalf("unexpected response: %s", recorder.Body.String())
	}
}

func TestJSONEndpointsRequireJSONContentType(t *testing.T) {
	handler, closeStore := newSecurityTestServer(t, config.Config{})
	defer closeStore()

	request := httptest.NewRequest(http.MethodPost, "/api/admin/login", strings.NewReader(`{"password":"password123"}`))
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("expected 415, got %d", recorder.Code)
	}
}
