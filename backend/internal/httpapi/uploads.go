package httpapi

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

var imageExtensions = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/gif":  ".gif",
	"image/webp": ".webp",
}

var audioExtensions = map[string]string{
	"application/ogg": ".ogg",
	"audio/aac":       ".aac",
	"audio/mp4":       ".m4a",
	"audio/mpeg":      ".mp3",
	"audio/ogg":       ".ogg",
	"audio/opus":      ".opus",
	"audio/wav":       ".wav",
	"audio/wave":      ".wav",
	"audio/webm":      ".webm",
	"audio/x-m4a":     ".m4a",
	"audio/x-wav":     ".wav",
	"video/mp4":       ".m4a",
	"video/webm":      ".webm",
}

var audioFilenameExtensions = map[string]struct{}{
	".aac":  {},
	".m4a":  {},
	".mp3":  {},
	".ogg":  {},
	".opus": {},
	".wav":  {},
	".webm": {},
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

func (s *Server) uploadAudio(w http.ResponseWriter, r *http.Request) {
	maxBytes := s.cfg.MaxAudioUploadBytes
	if maxBytes <= 0 {
		writeError(w, http.StatusInternalServerError, "audio upload is not configured")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxBytes+2*1024*1024)
	if err := r.ParseMultipartForm(1024 * 1024); err != nil {
		writeError(w, http.StatusBadRequest, "invalid upload")
		return
	}
	if r.MultipartForm != nil {
		defer r.MultipartForm.RemoveAll()
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "file is required")
		return
	}
	defer file.Close()

	var waveform []int
	if raw := strings.TrimSpace(r.FormValue("waveform")); raw != "" {
		if err := json.Unmarshal([]byte(raw), &waveform); err != nil {
			writeError(w, http.StatusBadRequest, "invalid waveform")
			return
		}
		if len(waveform) < 8 || len(waveform) > 512 {
			writeError(w, http.StatusBadRequest, "invalid waveform")
			return
		}
		for _, peak := range waveform {
			if peak < 0 || peak > 100 {
				writeError(w, http.StatusBadRequest, "invalid waveform")
				return
			}
		}
	}

	head := make([]byte, 512)
	n, err := io.ReadFull(file, head)
	if err != nil && err != io.EOF && err != io.ErrUnexpectedEOF {
		writeError(w, http.StatusBadRequest, "could not read upload")
		return
	}
	head = head[:n]
	if len(head) == 0 {
		writeError(w, http.StatusBadRequest, "file is empty")
		return
	}

	contentType := http.DetectContentType(head)
	extension, ok := audioExtensions[contentType]
	if !ok {
		extension, ok = audioFilenameExtension(header.Filename)
	}
	if !ok {
		writeError(w, http.StatusUnsupportedMediaType, "unsupported audio type")
		return
	}

	name, err := randomUploadName(extension)
	if err != nil {
		s.logError("generate audio upload name failed", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	temp, err := os.CreateTemp(s.cfg.UploadsDir, ".audio-*")
	if err != nil {
		s.logError("create audio upload failed", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	tempName := temp.Name()
	defer func() {
		_ = temp.Close()
		_ = os.Remove(tempName)
	}()

	written, err := temp.Write(head)
	if err != nil {
		s.logError("write audio upload failed", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	remaining := maxBytes - int64(written)
	if remaining < 0 {
		remaining = 0
	}
	copied, err := io.Copy(temp, io.LimitReader(file, remaining+1))
	if err != nil {
		s.logError("write audio upload failed", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	if int64(written)+copied > maxBytes {
		writeError(w, http.StatusRequestEntityTooLarge, "file is too large")
		return
	}
	if err := temp.Chmod(0o644); err != nil {
		s.logError("chmod audio upload failed", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	if err := temp.Close(); err != nil {
		s.logError("close audio upload failed", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	target := filepath.Join(s.cfg.UploadsDir, name)
	if err := os.Rename(tempName, target); err != nil {
		s.logError("save audio upload failed", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	if len(waveform) > 0 {
		data, err := json.Marshal(waveform)
		if err != nil {
			s.logError("encode audio waveform failed", err)
		} else {
			sidecar := strings.TrimSuffix(target, filepath.Ext(target)) + ".json"
			if err := os.WriteFile(sidecar, data, 0o644); err != nil {
				s.logError("write audio waveform failed", err)
			}
		}
	}

	writeJSON(w, http.StatusCreated, map[string]string{"url": fmt.Sprintf("/uploads/%s", name)})
}

func randomUploadName(extension string) (string, error) {
	random := make([]byte, 16)
	if _, err := rand.Read(random); err != nil {
		return "", err
	}
	return hex.EncodeToString(random) + extension, nil
}

func audioFilenameExtension(filename string) (string, bool) {
	extension := strings.ToLower(filepath.Ext(filename))
	_, ok := audioFilenameExtensions[extension]
	return extension, ok
}
