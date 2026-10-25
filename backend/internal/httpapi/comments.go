package httpapi

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"pollo.city/internal/store"
)

type commentRequest struct {
	Name string `json:"name"`
	Body string `json:"body"`
}

func (s *Server) listComments(w http.ResponseWriter, r *http.Request) {
	comments, err := s.store.ListComments(r.Context(), r.PathValue("slug"))
	if err != nil {
		s.logError("list comments failed", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"comments": comments})
}

func (s *Server) addComment(w http.ResponseWriter, r *http.Request) {
	var request commentRequest
	if !decodeJSON(w, r, &request, 64<<10) {
		return
	}

	name := strings.TrimSpace(request.Name)
	body := strings.TrimSpace(request.Body)
	if len([]rune(name)) < 2 || len([]rune(name)) > 48 {
		writeError(w, http.StatusBadRequest, "name must have between 2 and 48 characters")
		return
	}
	if len([]rune(body)) < 2 || len([]rune(body)) > 800 {
		writeError(w, http.StatusBadRequest, "comment must have between 2 and 800 characters")
		return
	}

	allowed, retryAfter := s.commentLimiter.allow(clientRateLimitKey(r), time.Now())
	if !allowed {
		seconds := int(retryAfter / time.Second)
		if retryAfter%time.Second != 0 {
			seconds += 1
		}
		if seconds < 1 {
			seconds = 1
		}
		w.Header().Set("Retry-After", strconv.Itoa(seconds))
		writeError(w, http.StatusTooManyRequests, "too many comments, try again later")
		return
	}

	comment, err := s.store.AddComment(r.Context(), r.PathValue("slug"), store.CommentInput{Name: name, Body: body})
	if err != nil {
		s.writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"comment": comment})
}
