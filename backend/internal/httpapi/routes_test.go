package httpapi

import (
	"context"
	"encoding/json"
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
	"pollo.city/internal/domain"
	"pollo.city/internal/store"
	"pollo.city/internal/store/sqlite"
)

func TestPageRoutes(t *testing.T) {
	pagesDir := t.TempDir()
	writePage(t, pagesDir, "index.html", "index page")
	writePage(t, pagesDir, "off-topic.html", "off-topic page")
	writePage(t, pagesDir, "arquivo.html", "archive page")
	writePage(t, pagesDir, "sobre.html", "about page")
	writePage(t, pagesDir, "post.html", "post page")
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
		{name: "index legacy html", method: http.MethodGet, target: "/index.html", status: http.StatusMovedPermanently, location: "/"},
		{name: "index legacy html with query", method: http.MethodGet, target: "/index.html?tag=go", status: http.StatusMovedPermanently, location: "/?tag=go"},
		{name: "off-topic clean route", method: http.MethodGet, target: "/off-topic", status: http.StatusOK, bodyContains: "off-topic page"},
		{name: "off-topic trailing slash", method: http.MethodGet, target: "/off-topic/", status: http.StatusMovedPermanently, location: "/off-topic"},
		{name: "off-topic legacy html", method: http.MethodGet, target: "/off-topic.html", status: http.StatusMovedPermanently, location: "/off-topic"},
		{name: "archive clean route", method: http.MethodGet, target: "/arquivo", status: http.StatusOK, bodyContains: "archive page"},
		{name: "archive legacy html", method: http.MethodGet, target: "/arquivo.html", status: http.StatusMovedPermanently, location: "/arquivo"},
		{name: "about clean route", method: http.MethodGet, target: "/sobre", status: http.StatusOK, bodyContains: "about page"},
		{name: "about legacy html", method: http.MethodGet, target: "/sobre.html", status: http.StatusMovedPermanently, location: "/sobre"},
		{name: "post clean route", method: http.MethodGet, target: "/post/meu-artigo", status: http.StatusOK, bodyContains: "post page"},
		{name: "post legacy html", method: http.MethodGet, target: "/post.html?slug=meu-artigo", status: http.StatusMovedPermanently, location: "/post/meu-artigo"},
		{name: "post legacy html without slug", method: http.MethodGet, target: "/post.html", status: http.StatusMovedPermanently, location: "/"},
		{name: "post route without slug", method: http.MethodGet, target: "/post", status: http.StatusMovedPermanently, location: "/"},
		{name: "post route trailing slash", method: http.MethodGet, target: "/post/", status: http.StatusMovedPermanently, location: "/"},
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

func TestListPostsSectionFilter(t *testing.T) {
	database, err := sqlite.New(filepath.Join(t.TempDir(), "pollo.db"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer database.Close()

	ctx := context.Background()
	if _, err := database.CreatePost(ctx, store.PostInput{
		Title: "Artigo",
		Body:  "Conteúdo do artigo.",
	}); err != nil {
		t.Fatalf("create article: %v", err)
	}
	if _, err := database.CreatePost(ctx, store.PostInput{
		Title:   "Off-topic",
		Body:    "Conteúdo off-topic.",
		Section: domain.SectionOffTopic,
	}); err != nil {
		t.Fatalf("create off-topic: %v", err)
	}

	cfg := config.Config{
		PublicDir:  t.TempDir(),
		UploadsDir: t.TempDir(),
		SessionTTL: time.Hour,
	}
	server, err := New(cfg, database, auth.New(database, "password123", time.Hour), slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatalf("create server: %v", err)
	}

	request := httptest.NewRequest(http.MethodGet, "/api/posts?section=off-topic", nil)
	recorder := httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}
	var payload struct {
		Posts []domain.Post `json:"posts"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode posts: %v", err)
	}
	if len(payload.Posts) != 1 || payload.Posts[0].Section != domain.SectionOffTopic {
		t.Fatalf("unexpected filtered posts: %+v", payload.Posts)
	}

	request = httptest.NewRequest(http.MethodGet, "/api/posts?section=invalid", nil)
	recorder = httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, request)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", recorder.Code)
	}
}

func writePage(t *testing.T, directory, name, body string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(directory, name), []byte(body), 0o644); err != nil {
		t.Fatalf("write page %s: %v", name, err)
	}
}
