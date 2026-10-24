package httpapi

import (
	"net/http"
	"strings"

	"pollo.city/internal/store"
)

type aboutRequest struct {
	Title string `json:"title"`
	Lede  string `json:"lede"`
	Body  string `json:"body"`
}

func (s *Server) getAbout(w http.ResponseWriter, r *http.Request) {
	about, err := s.store.GetAbout(r.Context())
	if err != nil {
		s.logError("get about page failed", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"about": about})
}

func (s *Server) updateAbout(w http.ResponseWriter, r *http.Request) {
	var request aboutRequest
	if !decodeJSON(w, r, &request, 2<<20) {
		return
	}

	title := strings.TrimSpace(request.Title)
	lede := strings.TrimSpace(request.Lede)
	if title == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}
	if len([]rune(title)) > 100 {
		writeError(w, http.StatusBadRequest, "title is too long")
		return
	}
	if len([]rune(lede)) > 500 {
		writeError(w, http.StatusBadRequest, "lede is too long")
		return
	}

	about, err := s.store.UpdateAbout(r.Context(), store.AboutInput{
		Title: title,
		Lede:  lede,
		Body:  request.Body,
	})
	if err != nil {
		s.writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"about": about})
}
