package httpapi

import (
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"

	"pollo.city/internal/uploads"
)

var hashedAsset = regexp.MustCompile(`-[A-Za-z0-9_-]{8}\.(?:css|js|woff2?|ttf|otf)$`)

var uploadContentTypes = map[string]string{
	".aac":  "audio/aac",
	".gif":  "image/gif",
	".jpeg": "image/jpeg",
	".jpg":  "image/jpeg",
	".json": "application/json; charset=utf-8",
	".m4a":  "audio/mp4",
	".mp3":  "audio/mpeg",
	".ogg":  "audio/ogg",
	".opus": "audio/ogg",
	".png":  "image/png",
	".wav":  "audio/wav",
	".webm": "audio/webm",
	".webp": "image/webp",
}

func (s *Server) staticHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		requestPath := path.Clean("/" + r.URL.Path)
		if strings.HasPrefix(requestPath, "/assets/") {
			s.serveAssetFile(w, r, strings.TrimPrefix(requestPath, "/"))
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

func (s *Server) legacyPostRedirect(w http.ResponseWriter, r *http.Request) {
	slug := strings.TrimSpace(r.URL.Query().Get("slug"))
	if slug == "" {
		s.permanentRedirect("/")(w, r)
		return
	}
	http.Redirect(w, r, "/post/"+url.PathEscape(slug), http.StatusMovedPermanently)
}

func (s *Server) trailingSlashPostRedirect(w http.ResponseWriter, r *http.Request) {
	target := "/post/" + url.PathEscape(r.PathValue("slug"))
	if r.URL.RawQuery != "" {
		target += "?" + r.URL.RawQuery
	}
	http.Redirect(w, r, target, http.StatusMovedPermanently)
}

func (s *Server) servePublicFile(w http.ResponseWriter, r *http.Request, relative string) {
	w.Header().Set("Cache-Control", "no-cache")
	if !s.serveRegularFile(w, r, filepath.Join(s.cfg.PublicDir, filepath.FromSlash(relative))) {
		http.NotFound(w, r)
	}
}

func (s *Server) serveAssetFile(w http.ResponseWriter, r *http.Request, relative string) {
	target := filepath.Join(s.cfg.PublicDir, filepath.FromSlash(relative))
	info, err := os.Stat(target)
	if err != nil || !info.Mode().IsRegular() {
		http.NotFound(w, r)
		return
	}

	// Vite output files have content hashes and can be cached forever. Source
	// assets such as theme-init.js and default thumbnails are revalidated.
	if hashedAsset.MatchString(relative) {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	} else {
		w.Header().Set("Cache-Control", "public, max-age=3600")
	}
	http.ServeFile(w, r, target)
}

func (s *Server) serveRegularFile(w http.ResponseWriter, r *http.Request, filename string) bool {
	info, err := os.Stat(filename)
	if err != nil || !info.Mode().IsRegular() {
		return false
	}
	http.ServeFile(w, r, filename)
	return true
}

func (s *Server) serveUploadFile(w http.ResponseWriter, r *http.Request, name string) {
	if !uploads.IsStoredName(name) {
		http.NotFound(w, r)
		return
	}
	extension := strings.ToLower(filepath.Ext(name))
	contentType, ok := uploadContentTypes[extension]
	if !ok {
		http.NotFound(w, r)
		return
	}

	filename := filepath.Join(s.cfg.UploadsDir, name)
	info, err := os.Stat(filename)
	if err != nil || !info.Mode().IsRegular() {
		http.NotFound(w, r)
		return
	}

	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	w.Header().Set("Content-Type", contentType)
	http.ServeFile(w, r, filename)
}
