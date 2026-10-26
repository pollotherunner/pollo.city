package httpapi

import (
	"errors"
	"html"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"pollo.city/internal/store"
)

func (s *Server) postPage(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	post, err := s.store.GetPost(r.Context(), slug)
	if errors.Is(err, store.ErrNotFound) {
		s.serveHTMLWithMeta(w, r, "post.html", http.StatusNotFound, "Artigo não encontrado — pollo.city", "", "website", true)
		return
	}
	if err != nil {
		s.logError("get post page failed", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	description := strings.TrimSpace(post.Excerpt)
	if description == "" {
		description = post.Title
	}
	s.serveHTMLWithMeta(w, r, "post.html", http.StatusOK, post.Title+" — pollo.city", description, "article", false)
}

func (s *Server) aboutPage(w http.ResponseWriter, r *http.Request) {
	about, err := s.store.GetAbout(r.Context())
	if err != nil {
		s.logError("get about page failed", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	title := "pollo.city"
	if strings.TrimSpace(about.Title) != "" {
		title = about.Title + " — pollo.city"
	}
	s.serveHTMLWithMeta(w, r, "sobre.html", http.StatusOK, title, about.Lede, "website", false)
}

func (s *Server) serveHTMLWithMeta(w http.ResponseWriter, r *http.Request, relative string, status int, title string, description string, ogType string, noindex bool) {
	document, err := os.ReadFile(filepath.Join(s.cfg.PublicDir, filepath.FromSlash(relative)))
	if err != nil {
		s.logError("read page for metadata failed", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	escapedTitle := html.EscapeString(title)
	escapedDescription := html.EscapeString(strings.TrimSpace(description))
	page := strings.Replace(string(document), "<title>pollo.city</title>", "<title>"+escapedTitle+"</title>", 1)
	page = strings.Replace(page, `<meta name="description" content="">`, `<meta name="description" content="`+escapedDescription+`">`, 1)

	var extra strings.Builder
	extra.WriteString(`<meta property="og:title" content="` + escapedTitle + `">`)
	if escapedDescription != "" {
		extra.WriteString(`<meta property="og:description" content="` + escapedDescription + `">`)
	}
	extra.WriteString(`<meta property="og:type" content="` + html.EscapeString(ogType) + `">`)
	if status == http.StatusOK {
		scheme := "http"
		if r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https") {
			scheme = "https"
		}
		canonical := scheme + "://" + r.Host + r.URL.EscapedPath()
		escapedCanonical := html.EscapeString(canonical)
		extra.WriteString(`<link rel="canonical" href="` + escapedCanonical + `">`)
		extra.WriteString(`<meta property="og:url" content="` + escapedCanonical + `">`)
	}
	if noindex {
		extra.WriteString(`<meta name="robots" content="noindex">`)
	}
	if strings.Contains(page, "</head>") {
		page = strings.Replace(page, "</head>", extra.String()+"\n</head>", 1)
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Content-Length", strconv.Itoa(len(page)))
	w.WriteHeader(status)
	if r.Method != http.MethodHead {
		_, _ = w.Write([]byte(page))
	}
}
