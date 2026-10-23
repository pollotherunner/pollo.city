package httpapi

import (
	"net/http"
	"path"
	"path/filepath"
	"strings"
)

var publicPages = map[string]string{
	"/":             "index.html",
	"/index.html":   "index.html",
	"/post.html":    "post.html",
	"/arquivo.html": "arquivo.html",
	"/sobre.html":   "sobre.html",
	"/admin.html":   "admin.html",
	"/favicon.svg":  "favicon.svg",
}

func (s *Server) staticHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		requestPath := path.Clean("/" + r.URL.Path)
		if page, ok := publicPages[requestPath]; ok {
			s.servePublicFile(w, r, page, false)
			return
		}
		if strings.HasPrefix(requestPath, "/assets/") {
			s.servePublicFile(w, r, strings.TrimPrefix(requestPath, "/"), true)
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

func (s *Server) servePublicFile(w http.ResponseWriter, r *http.Request, relative string, cacheable bool) {
	if cacheable {
		w.Header().Set("Cache-Control", "public, max-age=3600")
	} else {
		w.Header().Set("Cache-Control", "no-cache")
	}
	http.ServeFile(w, r, filepath.Join(s.cfg.PublicDir, filepath.FromSlash(relative)))
}

func (s *Server) serveUploadFile(w http.ResponseWriter, r *http.Request, name string) {
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	http.ServeFile(w, r, filepath.Join(s.cfg.UploadsDir, name))
}
