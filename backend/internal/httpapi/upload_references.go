package httpapi

import (
	"net/http"
	"strings"

	"pollo.city/internal/uploads"
)

func (s *Server) validateUploadReferences(w http.ResponseWriter, texts ...string) bool {
	missing, err := uploads.MissingFiles(s.cfg.UploadsDir, texts...)
	if err != nil {
		s.logError("validate upload references failed", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return false
	}
	if len(missing) > 0 {
		writeError(w, http.StatusBadRequest, "uploaded file not found: "+strings.Join(missing, ", "))
		return false
	}
	return true
}
