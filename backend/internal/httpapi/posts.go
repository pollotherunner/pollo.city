package httpapi

import (
	"net/http"
	"strings"

	"pollo.city/internal/domain"
	"pollo.city/internal/store"
	"pollo.city/internal/uploads"
)

type postRequest struct {
	Title     string   `json:"title"`
	Excerpt   string   `json:"excerpt"`
	Tags      []string `json:"tags"`
	Thumbnail string   `json:"thumbnail"`
	Body      string   `json:"body"`
	Section   string   `json:"section"`
	Audio     string   `json:"audio"`
}

func (s *Server) listPosts(w http.ResponseWriter, r *http.Request) {
	section := strings.TrimSpace(r.URL.Query().Get("section"))
	if section != "" && !domain.ValidSection(section) {
		writeError(w, http.StatusBadRequest, "invalid section")
		return
	}

	posts, err := s.store.ListPosts(r.Context())
	if err != nil {
		s.logError("list posts failed", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	if section != "" {
		filtered := make([]domain.Post, 0, len(posts))
		for _, post := range posts {
			if post.Section == section {
				filtered = append(filtered, post)
			}
		}
		posts = filtered
	}

	writeJSON(w, http.StatusOK, map[string]any{"posts": posts})
}

func (s *Server) getPost(w http.ResponseWriter, r *http.Request) {
	post, err := s.store.GetPost(r.Context(), r.PathValue("slug"))
	if err != nil {
		s.writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"post": post})
}

func (s *Server) listTags(w http.ResponseWriter, r *http.Request) {
	tags, err := s.store.ListTags(r.Context())
	if err != nil {
		s.logError("list tags failed", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"tags": tags})
}

func (s *Server) createPost(w http.ResponseWriter, r *http.Request) {
	var request postRequest
	if !decodeJSON(w, r, &request, 2<<20) {
		return
	}
	if !validatePost(w, request) {
		return
	}
	unlockFiles := uploads.LockFilesRead()
	defer unlockFiles()
	if !s.validateUploadReferences(w, request.Body, request.Thumbnail, request.Audio) {
		return
	}
	post, err := s.store.CreatePost(r.Context(), store.PostInput{
		Title:     strings.TrimSpace(request.Title),
		Excerpt:   strings.TrimSpace(request.Excerpt),
		Tags:      request.Tags,
		Thumbnail: strings.TrimSpace(request.Thumbnail),
		Body:      request.Body,
		Section:   strings.TrimSpace(request.Section),
		Audio:     strings.TrimSpace(request.Audio),
	})
	if err != nil {
		s.writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"post": post})
}

func (s *Server) updatePost(w http.ResponseWriter, r *http.Request) {
	var request postRequest
	if !decodeJSON(w, r, &request, 2<<20) {
		return
	}
	if !validatePost(w, request) {
		return
	}
	unlockFiles := uploads.LockFilesRead()
	defer unlockFiles()
	if !s.validateUploadReferences(w, request.Body, request.Thumbnail, request.Audio) {
		return
	}
	post, err := s.store.UpdatePost(r.Context(), r.PathValue("slug"), store.PostInput{
		Title:     strings.TrimSpace(request.Title),
		Excerpt:   strings.TrimSpace(request.Excerpt),
		Tags:      request.Tags,
		Thumbnail: strings.TrimSpace(request.Thumbnail),
		Body:      request.Body,
		Section:   strings.TrimSpace(request.Section),
		Audio:     strings.TrimSpace(request.Audio),
	})
	if err != nil {
		s.writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"post": post})
}

func (s *Server) deletePost(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeletePost(r.Context(), r.PathValue("slug")); err != nil {
		s.writeStoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func validatePost(w http.ResponseWriter, request postRequest) bool {
	title := strings.TrimSpace(request.Title)
	if title == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return false
	}
	if len([]rune(title)) > 100 {
		writeError(w, http.StatusBadRequest, "title is too long")
		return false
	}
	if strings.TrimSpace(request.Body) == "" {
		writeError(w, http.StatusBadRequest, "body is required")
		return false
	}
	if len([]rune(request.Excerpt)) > 500 {
		writeError(w, http.StatusBadRequest, "excerpt is too long")
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
