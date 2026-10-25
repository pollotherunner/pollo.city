package httpapi

import (
	"net/http"
	"strings"

	"pollo.city/internal/domain"
	"pollo.city/internal/store"
)

type draftRequest struct {
	PostSlug  string   `json:"postSlug"`
	Title     string   `json:"title"`
	Excerpt   string   `json:"excerpt"`
	Tags      []string `json:"tags"`
	Thumbnail string   `json:"thumbnail"`
	Body      string   `json:"body"`
	Section   string   `json:"section"`
	Audio     string   `json:"audio"`
}

func (s *Server) listDrafts(w http.ResponseWriter, r *http.Request) {
	drafts, err := s.store.ListDrafts(r.Context())
	if err != nil {
		s.logError("list drafts failed", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"drafts": drafts})
}

func (s *Server) createDraft(w http.ResponseWriter, r *http.Request) {
	var request draftRequest
	if !decodeJSON(w, r, &request, 2<<20) {
		return
	}
	if !validateDraft(w, request) {
		return
	}
	draft, err := s.store.CreateDraft(r.Context(), store.DraftInput{
		PostSlug:  strings.TrimSpace(request.PostSlug),
		Title:     strings.TrimSpace(request.Title),
		Excerpt:   strings.TrimSpace(request.Excerpt),
		Tags:      request.Tags,
		Thumbnail: strings.TrimSpace(request.Thumbnail),
		Body:      request.Body,
		Section:   request.Section,
		Audio:     strings.TrimSpace(request.Audio),
	})
	if err != nil {
		s.writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"draft": draft})
}

func (s *Server) updateDraft(w http.ResponseWriter, r *http.Request) {
	var request draftRequest
	if !decodeJSON(w, r, &request, 2<<20) {
		return
	}
	if !validateDraft(w, request) {
		return
	}
	draft, err := s.store.UpdateDraft(r.Context(), r.PathValue("id"), store.DraftInput{
		PostSlug:  strings.TrimSpace(request.PostSlug),
		Title:     strings.TrimSpace(request.Title),
		Excerpt:   strings.TrimSpace(request.Excerpt),
		Tags:      request.Tags,
		Thumbnail: strings.TrimSpace(request.Thumbnail),
		Body:      request.Body,
		Section:   request.Section,
		Audio:     strings.TrimSpace(request.Audio),
	})
	if err != nil {
		s.writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"draft": draft})
}

func (s *Server) deleteDraft(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteDraft(r.Context(), r.PathValue("id")); err != nil {
		s.writeStoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func validateDraft(w http.ResponseWriter, request draftRequest) bool {
	if len([]rune(request.Title)) > 100 {
		writeError(w, http.StatusBadRequest, "title is too long")
		return false
	}
	if len([]rune(request.Excerpt)) > 500 {
		writeError(w, http.StatusBadRequest, "excerpt is too long")
		return false
	}
	if len([]rune(request.PostSlug)) > 100 {
		writeError(w, http.StatusBadRequest, "post slug is too long")
		return false
	}
	if len(request.Tags) > 8 {
		writeError(w, http.StatusBadRequest, "too many tags")
		return false
	}
	if len([]rune(request.Thumbnail)) > 2048 {
		writeError(w, http.StatusBadRequest, "thumbnail is too long")
		return false
	}
	audio := strings.TrimSpace(request.Audio)
	if len([]rune(audio)) > 2048 {
		writeError(w, http.StatusBadRequest, "audio is too long")
		return false
	}
	if audio != "" && (!strings.HasPrefix(audio, "/uploads/") || strings.Contains(audio, "..")) {
		writeError(w, http.StatusBadRequest, "invalid audio")
		return false
	}
	section := strings.TrimSpace(request.Section)
	if section != "" && !domain.ValidSection(section) {
		writeError(w, http.StatusBadRequest, "invalid section")
		return false
	}
	return true
}
