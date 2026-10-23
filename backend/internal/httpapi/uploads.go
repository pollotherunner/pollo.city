package httpapi

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
)

var imageExtensions = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/gif":  ".gif",
	"image/webp": ".webp",
}

func (s *Server) uploadImage(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, s.cfg.MaxUploadBytes+1024*1024)
	if err := r.ParseMultipartForm(1024 * 1024); err != nil {
		writeError(w, http.StatusBadRequest, "invalid upload")
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "file is required")
		return
	}
	defer file.Close()

	data, err := io.ReadAll(io.LimitReader(file, s.cfg.MaxUploadBytes+1))
	if err != nil {
		writeError(w, http.StatusBadRequest, "could not read upload")
		return
	}
	if int64(len(data)) > s.cfg.MaxUploadBytes {
		writeError(w, http.StatusRequestEntityTooLarge, "file is too large")
		return
	}
	if len(data) == 0 {
		writeError(w, http.StatusBadRequest, "file is empty")
		return
	}

	contentType := http.DetectContentType(data)
	extension, ok := imageExtensions[contentType]
	if !ok {
		writeError(w, http.StatusUnsupportedMediaType, "unsupported image type")
		return
	}

	random := make([]byte, 16)
	if _, err := rand.Read(random); err != nil {
		s.logError("generate upload name failed", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	name := hex.EncodeToString(random) + extension
	target := filepath.Join(s.cfg.UploadsDir, name)
	if err := os.WriteFile(target, data, 0o644); err != nil {
		s.logError("write upload failed", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{"url": fmt.Sprintf("/uploads/%s", name)})
}
