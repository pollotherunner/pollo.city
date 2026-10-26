package httpapi

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"pollo.city/internal/auth"
	"pollo.city/internal/config"
	"pollo.city/internal/domain"
	"pollo.city/internal/store"
	"pollo.city/internal/store/sqlite"
)

func newArchiveTestServer(t *testing.T) (http.Handler, *sqlite.Store, string, func()) {
	t.Helper()
	database, err := sqlite.New(filepath.Join(t.TempDir(), "pollo.db"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	uploadsDir := t.TempDir()
	cfg := config.Config{
		PublicDir:  t.TempDir(),
		UploadsDir: uploadsDir,
		SessionTTL: time.Hour,
	}
	server, err := New(cfg, database, auth.New(database, "password123", time.Hour), slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		database.Close()
		t.Fatalf("create server: %v", err)
	}
	return server.Handler(), database, uploadsDir, func() { database.Close() }
}

func loginCookie(t *testing.T, handler http.Handler) *http.Cookie {
	t.Helper()
	request := httptest.NewRequest(http.MethodPost, "/api/admin/login", strings.NewReader(`{"password":"password123"}`))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("login status: %d", recorder.Code)
	}
	cookies := recorder.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatal("login did not set a cookie")
	}
	return cookies[0]
}

func TestBackupArchiveImportRollsBackUploadsOnFailure(t *testing.T) {
	handler, database, uploadsDir, closeStore := newArchiveTestServer(t)
	defer closeStore()

	image := fmt.Sprintf("%032x.png", 3)
	if err := os.WriteFile(filepath.Join(uploadsDir, image), []byte("old"), 0o644); err != nil {
		t.Fatalf("write old upload: %v", err)
	}

	backup := domain.Backup{
		Version:    1,
		ExportedAt: time.Now().UTC(),
		Posts: []domain.Post{{
			Slug:      "post",
			Title:     "Post",
			Body:      "![Imagem](/uploads/" + image + ")",
			Date:      "2026-10-26",
			Section:   "article",
			Thumbnail: "/uploads/" + image,
		}},
		Drafts: []domain.Draft{{
			ID:       "draft",
			PostSlug: "post-inexistente",
			Title:    "Rascunho",
			Body:     "Texto",
			Section:  "article",
		}},
	}
	document, err := json.Marshal(backup)
	if err != nil {
		t.Fatalf("encode backup: %v", err)
	}

	var body bytes.Buffer
	writer := zip.NewWriter(&body)
	backupEntry, err := writer.Create("backup.json")
	if err != nil {
		t.Fatalf("create backup entry: %v", err)
	}
	if _, err := backupEntry.Write(document); err != nil {
		t.Fatalf("write backup entry: %v", err)
	}
	uploadEntry, err := writer.Create("uploads/" + image)
	if err != nil {
		t.Fatalf("create upload entry: %v", err)
	}
	if _, err := uploadEntry.Write([]byte("new")); err != nil {
		t.Fatalf("write upload entry: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close archive: %v", err)
	}

	cookie := loginCookie(t, handler)
	request := httptest.NewRequest(http.MethodPost, "/api/admin/import.zip", bytes.NewReader(body.Bytes()))
	request.Header.Set("Content-Type", "application/zip")
	request.AddCookie(cookie)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", recorder.Code, recorder.Body.String())
	}

	content, err := os.ReadFile(filepath.Join(uploadsDir, image))
	if err != nil {
		t.Fatalf("read restored upload: %v", err)
	}
	if string(content) != "old" {
		t.Fatalf("expected old upload to be restored, got %q", content)
	}
	posts, err := database.ListPosts(context.Background())
	if err != nil {
		t.Fatalf("list posts: %v", err)
	}
	if len(posts) != 0 {
		t.Fatalf("failed import should not change the database: %+v", posts)
	}
}

func TestBackupArchiveRoundTripIncludesUploads(t *testing.T) {
	source, sourceStore, sourceUploads, closeSource := newArchiveTestServer(t)
	defer closeSource()
	target, targetStore, targetUploads, closeTarget := newArchiveTestServer(t)
	defer closeTarget()

	image := fmt.Sprintf("%032x.png", 1)
	audio := fmt.Sprintf("%032x.mp3", 2)
	if err := os.WriteFile(filepath.Join(sourceUploads, image), []byte("image"), 0o644); err != nil {
		t.Fatalf("write image: %v", err)
	}
	if err := os.WriteFile(filepath.Join(sourceUploads, audio), []byte("audio"), 0o644); err != nil {
		t.Fatalf("write audio: %v", err)
	}
	if _, err := sourceStore.CreatePost(context.Background(), store.PostInput{
		Title:     "Backup completo",
		Body:      "![Imagem](/uploads/" + image + ")",
		Thumbnail: "/uploads/" + image,
		Audio:     "/uploads/" + audio,
	}); err != nil {
		t.Fatalf("create source post: %v", err)
	}

	cookie := loginCookie(t, source)
	exportRequest := httptest.NewRequest(http.MethodGet, "/api/admin/export.zip", nil)
	exportRequest.AddCookie(cookie)
	exportRecorder := httptest.NewRecorder()
	source.ServeHTTP(exportRecorder, exportRequest)
	if exportRecorder.Code != http.StatusOK {
		t.Fatalf("export status: %d", exportRecorder.Code)
	}
	if contentType := exportRecorder.Header().Get("Content-Type"); contentType != "application/zip" {
		t.Fatalf("unexpected export content type: %q", contentType)
	}

	archiveBytes := exportRecorder.Body.Bytes()
	reader, err := zip.NewReader(bytes.NewReader(archiveBytes), int64(len(archiveBytes)))
	if err != nil {
		t.Fatalf("open exported archive: %v", err)
	}
	names := make(map[string]bool)
	for _, entry := range reader.File {
		names[entry.Name] = true
	}
	if !names["backup.json"] || !names["uploads/"+image] || !names["uploads/"+audio] {
		t.Fatalf("archive is missing expected entries: %v", names)
	}

	targetCookie := loginCookie(t, target)
	importRequest := httptest.NewRequest(http.MethodPost, "/api/admin/import.zip", bytes.NewReader(archiveBytes))
	importRequest.Header.Set("Content-Type", "application/zip")
	importRequest.AddCookie(targetCookie)
	importRecorder := httptest.NewRecorder()
	target.ServeHTTP(importRecorder, importRequest)
	if importRecorder.Code != http.StatusOK {
		t.Fatalf("import status: %d: %s", importRecorder.Code, importRecorder.Body.String())
	}

	posts, err := targetStore.ListPosts(context.Background())
	if err != nil {
		t.Fatalf("list imported posts: %v", err)
	}
	if len(posts) != 1 || posts[0].Title != "Backup completo" {
		t.Fatalf("unexpected imported posts: %+v", posts)
	}
	for _, name := range []string{image, audio} {
		if _, err := os.Stat(filepath.Join(targetUploads, name)); err != nil {
			t.Fatalf("expected imported upload %s: %v", name, err)
		}
	}
}
