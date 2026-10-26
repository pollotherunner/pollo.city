package httpapi

import (
	"archive/zip"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"pollo.city/internal/domain"
	"pollo.city/internal/uploads"
)

const (
	maxBackupArchiveBytes  = 512 << 20
	maxBackupExpandedBytes = 1 << 30
	maxBackupEntryBytes    = 256 << 20
)

func (s *Server) exportBackupArchive(w http.ResponseWriter, r *http.Request) {
	unlockFiles := uploads.LockFilesRead()
	defer unlockFiles()

	backup, err := s.store.Export(r.Context())
	if err != nil {
		s.logError("export backup archive failed", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="pollo-city-%s.zip"`, time.Now().Format("2006-01-02")))
	w.Header().Set("Cache-Control", "no-store")

	archive := zip.NewWriter(w)
	defer archive.Close()

	document, err := archive.CreateHeader(&zip.FileHeader{Name: "backup.json", Method: zip.Deflate})
	if err != nil {
		s.logError("create backup document in archive failed", err)
		return
	}
	if err := json.NewEncoder(document).Encode(backup); err != nil {
		s.logError("encode backup document in archive failed", err)
		return
	}

	entries, err := os.ReadDir(s.cfg.UploadsDir)
	if err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			s.logError("read uploads for backup archive failed", err)
		}
		return
	}

	for _, entry := range entries {
		if entry.IsDir() || !uploads.IsStoredName(entry.Name()) {
			continue
		}
		info, err := entry.Info()
		if err != nil || !info.Mode().IsRegular() {
			continue
		}
		header, err := zip.FileInfoHeader(info)
		if err != nil {
			s.logError("build upload header for backup archive failed", err)
			continue
		}
		header.Name = "uploads/" + entry.Name()
		header.Method = zip.Deflate
		destination, err := archive.CreateHeader(header)
		if err != nil {
			s.logError("create upload entry in backup archive failed", err)
			return
		}
		source, err := os.Open(filepath.Join(s.cfg.UploadsDir, entry.Name()))
		if err != nil {
			s.logError("open upload for backup archive failed", err)
			continue
		}
		_, copyErr := io.Copy(destination, source)
		source.Close()
		if copyErr != nil {
			s.logError("copy upload to backup archive failed", copyErr)
			return
		}
	}
}

func (s *Server) importBackupArchive(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBackupArchiveBytes+1024*1024)
	temp, err := os.CreateTemp("", "pollo-backup-*.zip")
	if err != nil {
		s.logError("create backup archive temp file failed", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	tempName := temp.Name()
	defer os.Remove(tempName)

	written, err := io.Copy(temp, r.Body)
	if closeErr := temp.Close(); closeErr != nil && err == nil {
		err = closeErr
	}
	if err != nil {
		var maxBytesError *http.MaxBytesError
		if errors.As(err, &maxBytesError) {
			writeError(w, http.StatusRequestEntityTooLarge, "backup archive is too large")
			return
		}
		writeError(w, http.StatusBadRequest, "invalid backup archive")
		return
	}
	if written == 0 {
		writeError(w, http.StatusBadRequest, "backup archive is empty")
		return
	}

	archive, err := zip.OpenReader(tempName)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid backup archive")
		return
	}
	defer archive.Close()

	var backup *domain.Backup
	for _, entry := range archive.File {
		if entry.Name != "backup.json" {
			continue
		}
		backup, err = decodeBackupEntry(entry)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid backup document")
			return
		}
		break
	}
	if backup == nil {
		writeError(w, http.StatusBadRequest, "backup archive has no backup.json")
		return
	}
	if backup.Version != 1 {
		writeError(w, http.StatusBadRequest, "unsupported backup version")
		return
	}

	if err := s.extractBackupUploads(archive.File); err != nil {
		s.logError("extract backup uploads failed", err)
		writeError(w, http.StatusBadRequest, "invalid backup uploads")
		return
	}
	unlockFiles := uploads.LockFilesRead()
	defer unlockFiles()
	if missing, err := backupMissingUploads(s.cfg.UploadsDir, backup); err != nil {
		s.logError("validate backup uploads failed", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	} else if len(missing) > 0 {
		writeError(w, http.StatusBadRequest, "backup references missing uploads: "+strings.Join(missing, ", "))
		return
	}
	if err := s.store.Import(r.Context(), backup); err != nil {
		s.writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func backupMissingUploads(dir string, backup *domain.Backup) ([]string, error) {
	texts := make([]string, 0)
	for _, post := range backup.Posts {
		texts = append(texts, post.Body, post.Thumbnail, post.Audio)
	}
	for _, draft := range backup.Drafts {
		texts = append(texts, draft.Body, draft.Thumbnail, draft.Audio)
	}
	if backup.About != nil {
		texts = append(texts, backup.About.Body)
	}
	return uploads.MissingFiles(dir, texts...)
}

func decodeBackupEntry(entry *zip.File) (*domain.Backup, error) {
	reader, err := entry.Open()
	if err != nil {
		return nil, err
	}
	defer reader.Close()

	decoder := json.NewDecoder(io.LimitReader(reader, maxBackupEntryBytes))
	decoder.DisallowUnknownFields()
	var backup domain.Backup
	if err := decoder.Decode(&backup); err != nil {
		return nil, err
	}
	return &backup, nil
}

func (s *Server) extractBackupUploads(entries []*zip.File) error {
	unlockFiles := uploads.LockFilesWrite()
	defer unlockFiles()

	uploadEntries := make([]*zip.File, 0)
	var expanded uint64
	for _, entry := range entries {
		if !strings.HasPrefix(entry.Name, "uploads/") {
			continue
		}
		name := strings.TrimPrefix(entry.Name, "uploads/")
		if name == "" || strings.Contains(name, "/") || !uploads.IsStoredName(name) {
			return fmt.Errorf("invalid upload entry %q", entry.Name)
		}
		if entry.UncompressedSize64 > maxBackupEntryBytes {
			return fmt.Errorf("upload entry %q is too large", entry.Name)
		}
		expanded += entry.UncompressedSize64
		if expanded > maxBackupExpandedBytes {
			return fmt.Errorf("backup uploads are too large")
		}
		uploadEntries = append(uploadEntries, entry)
	}

	for _, entry := range uploadEntries {
		name := strings.TrimPrefix(entry.Name, "uploads/")
		target := filepath.Join(s.cfg.UploadsDir, name)
		if info, err := os.Lstat(target); err == nil && !info.Mode().IsRegular() {
			return fmt.Errorf("upload entry %q targets an unsafe file", entry.Name)
		}

		source, err := entry.Open()
		if err != nil {
			return err
		}
		destination, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
		if err != nil {
			source.Close()
			return err
		}
		copied, copyErr := io.Copy(destination, io.LimitReader(source, maxBackupEntryBytes+1))
		source.Close()
		closeErr := destination.Close()
		if copyErr != nil {
			os.Remove(target)
			return copyErr
		}
		if copied > maxBackupEntryBytes {
			os.Remove(target)
			return fmt.Errorf("upload entry %q is too large", entry.Name)
		}
		if closeErr != nil {
			os.Remove(target)
			return closeErr
		}
	}
	return nil
}
