package httpapi

import (
	"net/http"
	"path"
	"path/filepath"
	"strings"
)

func (s *Server) staticHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		requestPath := path.Clean("/" + r.URL.Path)
		if strings.HasPrefix(requestPath, "/assets/") {
			s.servePublicFile(w, r, strings.TrimPrefix(requestPath, "/"))
			return
		}
		if strings.HasPrefix(requestPath, "/uploads/") {
			name := strings.TrimPrefix(requestPath, "/uploads/")
			if name == "" || strings.Contains(name, "/") {
				http.NotFound(w, r)
				return
			}
			s.serveUploadFile(w, r, name)
			return
		}
		http.NotFound(w, r)
	})
}

func (s *Server) page(relative string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		s.servePublicFile(w, r, relative)
	}
}

func (s *Server) permanentRedirect(target string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		location := target
		if r.URL.RawQuery != "" {
			location += "?" + r.URL.RawQuery
		}
		http.Redirect(w, r, location, http.StatusMovedPermanently)
	}
}

func (s *Server) servePublicFile(w http.ResponseWriter, r *http.Request, relative string) {
	w.Header().Set("Cache-Control", "no-cache")
	http.ServeFile(w, r, filepath.Join(s.cfg.PublicDir, filepath.FromSlash(relative)))
}

func (s *Server) serveUploadFile(w http.ResponseWriter, r *http.Request, name string) {
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	http.ServeFile(w, r, filepath.Join(s.cfg.UploadsDir, name))
}
