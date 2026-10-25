package httpapi

import (
	"context"
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
	"pollo.city/internal/store"
	"pollo.city/internal/store/sqlite"
)

func TestCommentRateLimitHTTP(t *testing.T) {
	ctx := context.Background()
	database, err := sqlite.New(filepath.Join(t.TempDir(), "pollo.db"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer database.Close()

	if _, err := database.CreatePost(ctx, store.PostInput{
		Title: "Artigo com comentários",
		Body:  "Conteúdo",
	}); err != nil {
		t.Fatalf("create post: %v", err)
	}

	cfg := config.Config{
		PublicDir:         t.TempDir(),
		UploadsDir:        t.TempDir(),
		SessionTTL:        time.Hour,
		CommentRateLimit:  1,
		CommentRateWindow: time.Hour,
	}
	server, err := New(cfg, database, auth.New(database, "password123", time.Hour), slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatalf("create server: %v", err)
	}
	handler := server.Handler()

	send := func(remote string, name string) *httptest.ResponseRecorder {
		request := httptest.NewRequest(
			http.MethodPost,
			"/api/posts/artigo-com-comentarios/comments",
			strings.NewReader(`{"name":"`+name+`","body":"Mensagem de teste."}`),
		)
		request.RemoteAddr = remote
		request.Header.Set("Content-Type", "application/json")
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, request)
		return recorder
	}

	if recorder := send("203.0.113.10:1234", "A"); recorder.Code != http.StatusBadRequest {
		t.Fatalf("invalid comment should not be rate limited, got %d", recorder.Code)
	}
	if recorder := send("203.0.113.10:1234", "Pollo"); recorder.Code != http.StatusCreated {
		t.Fatalf("first valid comment status: %d", recorder.Code)
	}

	limited := send("203.0.113.10:1234", "Pollo")
	if limited.Code != http.StatusTooManyRequests {
		t.Fatalf("expected status 429, got %d", limited.Code)
	}
	if limited.Header().Get("Retry-After") == "" {
		t.Fatal("rate limited response is missing Retry-After")
	}

	if recorder := send("203.0.113.11:1234", "Outro"); recorder.Code != http.StatusCreated {
		t.Fatalf("a different IP should have its own limit, got %d", recorder.Code)
	}
}
