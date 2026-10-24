package httpapi

import (
	"fmt"
	"log/slog"
	"net/http"
	"os"

	"pollo.city/internal/auth"
	"pollo.city/internal/config"
	"pollo.city/internal/store"
)

type Server struct {
	cfg    config.Config
	store  store.Store
	auth   *auth.Service
	logger *slog.Logger
}

func New(cfg config.Config, st store.Store, authService *auth.Service, logger *slog.Logger) (*Server, error) {
	if err := os.MkdirAll(cfg.UploadsDir, 0o755); err != nil {
		return nil, fmt.Errorf("create uploads directory: %w", err)
	}
	return &Server{cfg: cfg, store: st, auth: authService, logger: logger}, nil
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", s.health)
	mux.HandleFunc("GET /api/posts", s.listPosts)
	mux.HandleFunc("GET /api/posts/{slug}", s.getPost)
	mux.HandleFunc("GET /api/tags", s.listTags)
	mux.HandleFunc("GET /api/posts/{slug}/comments", s.listComments)
	mux.HandleFunc("POST /api/posts/{slug}/comments", s.addComment)
	mux.HandleFunc("GET /api/about", s.getAbout)

	mux.HandleFunc("POST /api/admin/login", s.login)
	mux.HandleFunc("POST /api/admin/logout", s.logout)
	mux.HandleFunc("GET /api/admin/session", s.session)

	mux.Handle("POST /api/admin/posts", s.requireAdmin(http.HandlerFunc(s.createPost)))
	mux.Handle("PUT /api/admin/posts/{slug}", s.requireAdmin(http.HandlerFunc(s.updatePost)))
	mux.Handle("DELETE /api/admin/posts/{slug}", s.requireAdmin(http.HandlerFunc(s.deletePost)))

	mux.Handle("GET /api/admin/drafts", s.requireAdmin(http.HandlerFunc(s.listDrafts)))
	mux.Handle("POST /api/admin/drafts", s.requireAdmin(http.HandlerFunc(s.createDraft)))
	mux.Handle("PUT /api/admin/drafts/{id}", s.requireAdmin(http.HandlerFunc(s.updateDraft)))
	mux.Handle("DELETE /api/admin/drafts/{id}", s.requireAdmin(http.HandlerFunc(s.deleteDraft)))

	mux.Handle("POST /api/admin/uploads", s.requireAdmin(http.HandlerFunc(s.uploadImage)))
	mux.Handle("GET /api/admin/export", s.requireAdmin(http.HandlerFunc(s.exportBackup)))
	mux.Handle("POST /api/admin/import", s.requireAdmin(http.HandlerFunc(s.importBackup)))
	mux.Handle("PUT /api/admin/about", s.requireAdmin(http.HandlerFunc(s.updateAbout)))

	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotFound, "not found")
	})

	mux.HandleFunc("GET /{$}", s.page("index.html"))
	mux.HandleFunc("GET /index.html", s.page("index.html"))
	mux.HandleFunc("GET /post.html", s.page("post.html"))
	mux.HandleFunc("GET /arquivo.html", s.page("arquivo.html"))
	mux.HandleFunc("GET /sobre.html", s.page("sobre.html"))
	mux.HandleFunc("GET /favicon.svg", s.page("favicon.svg"))
	mux.HandleFunc("GET /admin", s.page("admin.html"))
	mux.HandleFunc("GET /admin/{$}", s.permanentRedirect("/admin"))
	mux.HandleFunc("GET /admin.html", s.permanentRedirect("/admin"))

	mux.Handle("/", s.staticHandler())

	return s.middleware(mux)
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	if err := s.store.Ping(r.Context()); err != nil {
		s.logError("health check failed", err)
		writeError(w, http.StatusServiceUnavailable, "unavailable")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
