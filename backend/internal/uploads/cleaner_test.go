package uploads

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"testing"
	"time"

	"pollo.city/internal/domain"
	"pollo.city/internal/store"
	"pollo.city/internal/store/sqlite"
)

func TestCleanerRemovesOnlyOldUnreferencedUploads(t *testing.T) {
	ctx := context.Background()
	database, err := sqlite.New(filepath.Join(t.TempDir(), "pollo.db"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer database.Close()

	uploadsDir := t.TempDir()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	old := time.Now().Add(-48 * time.Hour)
	writeUpload := func(name string, content string, modTime time.Time) {
		t.Helper()
		path := filepath.Join(uploadsDir, name)
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			t.Fatalf("write %s: %v", name, err)
		}
		if err := os.Chtimes(path, modTime, modTime); err != nil {
			t.Fatalf("set time on %s: %v", name, err)
		}
	}

	name := func(value int, extension string) string {
		return fmt.Sprintf("%032x%s", value, extension)
	}

	thumbnail := name(1, ".png")
	bodyImage := name(2, ".png")
	postAudio := name(3, ".mp3")
	draftThumbnail := name(4, ".png")
	draftBodyImage := name(5, ".png")
	aboutImage := name(6, ".png")

	writeUpload(thumbnail, "thumbnail", old)
	writeUpload(bodyImage, "body", old)
	writeUpload(postAudio, "audio", old)
	writeUpload(name(3, ".json"), "waveform", old)
	writeUpload(draftThumbnail, "draft thumbnail", old)
	writeUpload(draftBodyImage, "draft body", old)
	writeUpload(aboutImage, "about", old)

	orphanImage := name(7, ".png")
	orphanAudio := name(8, ".mp3")
	orphanWaveform := name(8, ".json")
	writeUpload(orphanImage, "orphan", old)
	writeUpload(orphanAudio, "orphan audio", old)
	writeUpload(orphanWaveform, "orphan waveform", old)

	recentImage := name(9, ".png")
	writeUpload(recentImage, "recent", time.Now())
	writeUpload(".audio-crashed", "temp", old)
	writeUpload("notes.txt", "not managed", old)

	if _, err := database.CreatePost(ctx, store.PostInput{
		Title:     "Artigo",
		Body:      "![Imagem](https://pollo.city/uploads/" + bodyImage + ")",
		Thumbnail: "/uploads/" + thumbnail,
		Audio:     "/uploads/" + postAudio,
	}); err != nil {
		t.Fatalf("create post: %v", err)
	}
	if _, err := database.CreateDraft(ctx, store.DraftInput{
		Title:     "Rascunho",
		Body:      "![Imagem](/uploads/" + draftBodyImage + ")",
		Thumbnail: "/uploads/" + draftThumbnail,
	}); err != nil {
		t.Fatalf("create draft: %v", err)
	}
	if _, err := database.UpdateAbout(ctx, store.AboutInput{
		Title: "Sobre",
		Body:  "![Imagem](/uploads/" + aboutImage + ")",
	}); err != nil {
		t.Fatalf("update about: %v", err)
	}

	report, err := NewCleaner(database, uploadsDir, 24*time.Hour, logger).Run(ctx)
	if err != nil {
		t.Fatalf("run cleaner: %v", err)
	}

	if report.Scanned != 12 || report.Kept != 7 || report.Deleted != 4 || report.SkippedRecent != 1 || report.Ignored != 1 || report.Failed != 0 {
		t.Fatalf("unexpected report: %+v", report)
	}
	if report.FreedBytes <= 0 {
		t.Fatalf("expected freed bytes, got %d", report.FreedBytes)
	}

	for _, name := range []string{thumbnail, bodyImage, postAudio, name(3, ".json"), draftThumbnail, draftBodyImage, aboutImage, recentImage} {
		if _, err := os.Stat(filepath.Join(uploadsDir, name)); err != nil {
			t.Fatalf("expected %s to be kept: %v", name, err)
		}
	}
	for _, name := range []string{orphanImage, orphanAudio, orphanWaveform, ".audio-crashed"} {
		if _, err := os.Stat(filepath.Join(uploadsDir, name)); !os.IsNotExist(err) {
			t.Fatalf("expected %s to be deleted, stat error: %v", name, err)
		}
	}
	if _, err := os.Stat(filepath.Join(uploadsDir, "notes.txt")); err != nil {
		t.Fatalf("expected unmanaged file to be kept: %v", err)
	}
}

func TestCollectReferencesMatchesExactUploadNames(t *testing.T) {
	name := fmt.Sprintf("%032x.png", 42)
	contexts := []string{
		"Veja em https://pollo.city/uploads/" + name + ".",
		"![Imagem](/uploads/" + name + ")",
		"![Imagem](https://pollo.city/uploads/" + name + "?v=1)",
		"Arquivo /uploads/" + name + ", pronto.",
	}

	for _, body := range contexts {
		referenced := collectReferences([]domain.Post{{Body: body}}, nil, nil)
		if _, ok := referenced[name]; !ok {
			t.Fatalf("expected %s to be referenced in %q", name, body)
		}
		if len(referenced) != 1 {
			t.Fatalf("unexpected references for %q: %v", body, referenced)
		}
	}

	if references := collectReferences([]domain.Post{{Body: "/uploads/not-managed.png"}}, nil, nil); len(references) != 0 {
		t.Fatalf("unexpected references for an unmanaged file: %v", references)
	}
}

func TestCleanerDoesNotDeleteWhenDatabaseIsEmpty(t *testing.T) {
	database, err := sqlite.New(filepath.Join(t.TempDir(), "pollo.db"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer database.Close()

	uploadsDir := t.TempDir()
	name := fmt.Sprintf("%032x.png", 77)
	path := filepath.Join(uploadsDir, name)
	if err := os.WriteFile(path, []byte("orphan"), 0o644); err != nil {
		t.Fatalf("write upload: %v", err)
	}
	old := time.Now().Add(-48 * time.Hour)
	if err := os.Chtimes(path, old, old); err != nil {
		t.Fatalf("set upload time: %v", err)
	}

	report, err := NewCleaner(
		database,
		uploadsDir,
		24*time.Hour,
		slog.New(slog.NewTextHandler(io.Discard, nil)),
	).Run(context.Background())
	if err != nil {
		t.Fatalf("run cleaner: %v", err)
	}
	if !report.SkippedEmptyDatabase || report.Deleted != 0 {
		t.Fatalf("unexpected report: %+v", report)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("empty database should not delete media: %v", err)
	}
}

func TestCleanerIgnoresMissingUploadsDirectory(t *testing.T) {
	database, err := sqlite.New(filepath.Join(t.TempDir(), "pollo.db"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer database.Close()

	report, err := NewCleaner(
		database,
		filepath.Join(t.TempDir(), "missing"),
		24*time.Hour,
		slog.New(slog.NewTextHandler(io.Discard, nil)),
	).Run(context.Background())
	if err != nil {
		t.Fatalf("run cleaner: %v", err)
	}
	if report.Scanned != 0 || report.Deleted != 0 {
		t.Fatalf("unexpected report: %+v", report)
	}
}
