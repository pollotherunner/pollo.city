package httpapi

import (
	"archive/zip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"pollo.city/internal/domain"
	"pollo.city/internal/store"
	"pollo.city/internal/uploads"
)

const (
	maxBackupArchiveBytes  = 512 << 20
	maxBackupExpandedBytes = 1 << 30
	maxBackupEntryBytes    = 256 << 20
)

func (s *Server) exportBackupArchive(w http.ResponseWriter, r *http.Request) {
	temp, size, err := s.buildBackupArchive(r.Context())
	if err != nil {
		s.logError("build backup archive failed", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	tempName := temp.Name()
	defer func() {
		temp.Close()
		os.Remove(tempName)
	}()

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="pollo-city-%s.zip"`, time.Now().Format("2006-01-02")))
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Length", strconv.FormatInt(size, 10))
	w.WriteHeader(http.StatusOK)
	if r.Method == http.MethodHead {
		return
	}
	if _, err := io.Copy(w, temp); err != nil {
		s.logError("stream backup archive failed", err)
	}
}

func (s *Server) buildBackupArchive(ctx context.Context) (*os.File, int64, error) {
	unlockFiles := uploads.LockFilesRead()
	defer unlockFiles()

	backup, err := s.store.Export(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("export backup: %w", err)
	}

	temp, err := os.CreateTemp("", "pollo-export-*.zip")
	if err != nil {
		return nil, 0, err
	}
	discard := true
	defer func() {
		if discard {
			temp.Close()
			os.Remove(temp.Name())
		}
	}()

	archive := zip.NewWriter(temp)
	document, err := archive.CreateHeader(&zip.FileHeader{Name: "backup.json", Method: zip.Deflate})
	if err != nil {
		return nil, 0, err
	}
	if err := json.NewEncoder(document).Encode(backup); err != nil {
		return nil, 0, err
	}

	entries, err := os.ReadDir(s.cfg.UploadsDir)
	if err != nil {
		return nil, 0, fmt.Errorf("read uploads: %w", err)
	}
	for _, entry := range entries {
		if entry.IsDir() || !uploads.IsStoredName(entry.Name()) {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			return nil, 0, fmt.Errorf("inspect upload %s: %w", entry.Name(), err)
		}
		if !info.Mode().IsRegular() {
			continue
		}
		header, err := zip.FileInfoHeader(info)
		if err != nil {
			return nil, 0, fmt.Errorf("build upload header %s: %w", entry.Name(), err)
		}
		header.Name = "uploads/" + entry.Name()
		header.Method = zip.Deflate
		destination, err := archive.CreateHeader(header)
		if err != nil {
			return nil, 0, fmt.Errorf("create upload entry %s: %w", entry.Name(), err)
		}
		source, err := os.Open(filepath.Join(s.cfg.UploadsDir, entry.Name()))
		if err != nil {
			return nil, 0, fmt.Errorf("open upload %s: %w", entry.Name(), err)
		}
		_, copyErr := io.Copy(destination, source)
		closeErr := source.Close()
		if copyErr != nil {
			return nil, 0, fmt.Errorf("copy upload %s: %w", entry.Name(), copyErr)
		}
		if closeErr != nil {
			return nil, 0, fmt.Errorf("close upload %s: %w", entry.Name(), closeErr)
		}
	}

	if err := archive.Close(); err != nil {
		return nil, 0, fmt.Errorf("finish backup archive: %w", err)
	}
	info, err := temp.Stat()
	if err != nil {
		return nil, 0, err
	}
	if _, err := temp.Seek(0, io.SeekStart); err != nil {
		return nil, 0, err
	}
	discard = false
	return temp, info.Size(), nil
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

	if err := s.restoreBackupUploads(r.Context(), archive.File, backup); err != nil {
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

func (s *Server) restoreBackupUploads(ctx context.Context, entries []*zip.File, backup *domain.Backup) error {
	unlockFiles := uploads.LockFilesWrite()
	defer unlockFiles()

	uploadEntries := make([]*zip.File, 0)
	names := make([]string, 0)
	var expanded uint64
	for _, entry := range entries {
		if !strings.HasPrefix(entry.Name, "uploads/") {
			continue
		}
		name := strings.TrimPrefix(entry.Name, "uploads/")
		if name == "" || strings.Contains(name, "/") || !uploads.IsStoredName(name) {
			return fmt.Errorf("%w: invalid upload entry %q", store.ErrInvalid, entry.Name)
		}
		if entry.UncompressedSize64 > maxBackupEntryBytes {
			return fmt.Errorf("%w: upload entry %q is too large", store.ErrInvalid, entry.Name)
		}
		expanded += entry.UncompressedSize64
		if expanded > maxBackupExpandedBytes {
			return fmt.Errorf("%w: backup uploads are too large", store.ErrInvalid)
		}
		uploadEntries = append(uploadEntries, entry)
		names = append(names, name)
	}

	for _, name := range names {
		target := filepath.Join(s.cfg.UploadsDir, name)
		if info, err := os.Lstat(target); err == nil && !info.Mode().IsRegular() {
			return fmt.Errorf("%w: upload %q targets an unsafe file", store.ErrInvalid, name)
		} else if err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
	}

	staging, err := os.MkdirTemp(s.cfg.UploadsDir, ".restore-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(staging)

	for _, entry := range uploadEntries {
		name := strings.TrimPrefix(entry.Name, "uploads/")
		source, err := entry.Open()
		if err != nil {
			return err
		}
		destination, err := os.OpenFile(filepath.Join(staging, name), os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o644)
		if err != nil {
			source.Close()
			return err
		}
		copied, copyErr := io.Copy(destination, io.LimitReader(source, maxBackupEntryBytes+1))
		source.Close()
		closeErr := destination.Close()
		if copyErr != nil {
			return copyErr
		}
		if copied > maxBackupEntryBytes {
			return fmt.Errorf("%w: upload entry %q is too large", store.ErrInvalid, entry.Name)
		}
		if closeErr != nil {
			return closeErr
		}
	}

	if missing, err := backupMissingUploads(staging, backup); err != nil {
		return err
	} else if len(missing) > 0 {
		return fmt.Errorf("%w: backup references missing uploads: %s", store.ErrInvalid, strings.Join(missing, ", "))
	}

	backupDir, err := os.MkdirTemp(s.cfg.UploadsDir, ".restore-backup-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(backupDir)

	movedAside := make([]string, 0)
	installed := make([]string, 0)
	rollback := func() {
		for _, name := range installed {
			os.Remove(filepath.Join(s.cfg.UploadsDir, name))
		}
		for _, name := range movedAside {
			os.Rename(filepath.Join(backupDir, name), filepath.Join(s.cfg.UploadsDir, name))
		}
	}

	for _, name := range names {
		target := filepath.Join(s.cfg.UploadsDir, name)
		if _, err := os.Lstat(target); err == nil {
			if err := os.Rename(target, filepath.Join(backupDir, name)); err != nil {
				rollback()
				return err
			}
			movedAside = append(movedAside, name)
		}
		if err := os.Rename(filepath.Join(staging, name), target); err != nil {
			rollback()
			return err
		}
		installed = append(installed, name)
	}

	if err := s.store.Import(ctx, backup); err != nil {
		rollback()
		return err
	}
	return nil
}
