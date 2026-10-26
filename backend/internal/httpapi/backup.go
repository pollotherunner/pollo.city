package httpapi

import (
	"net/http"

	"pollo.city/internal/domain"
	"pollo.city/internal/uploads"
)

func (s *Server) exportBackup(w http.ResponseWriter, r *http.Request) {
	backup, err := s.store.Export(r.Context())
	if err != nil {
		s.logError("export backup failed", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, backup)
}

func (s *Server) importBackup(w http.ResponseWriter, r *http.Request) {
	var backup domain.Backup
	if !decodeJSON(w, r, &backup, 256<<20) {
		return
	}
	if backup.Version != 1 {
		writeError(w, http.StatusBadRequest, "unsupported backup version")
		return
	}
	unlockFiles := uploads.LockFilesRead()
	defer unlockFiles()
	if err := s.store.Import(r.Context(), &backup); err != nil {
		s.writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
