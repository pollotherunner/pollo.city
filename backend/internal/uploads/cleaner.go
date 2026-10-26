package uploads

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"pollo.city/internal/domain"
)

var (
	uploadReference = regexp.MustCompile(`/uploads/[A-Za-z0-9][A-Za-z0-9._-]*`)
	managedUpload   = regexp.MustCompile(`^[0-9a-f]{32}\.(?:aac|gif|jpe?g|m4a|mp3|ogg|opus|png|wav|webm|webp|json)$`)
)

var audioExtensions = []string{".aac", ".m4a", ".mp3", ".ogg", ".opus", ".wav", ".webm"}

// Store is the subset of the database used to discover referenced uploads.
type Store interface {
	ListPosts(ctx context.Context) ([]domain.Post, error)
	ListDrafts(ctx context.Context) ([]domain.Draft, error)
	GetAbout(ctx context.Context) (*domain.About, error)
}

type Report struct {
	Scanned       int
	Kept          int
	Deleted       int
	SkippedRecent int
	Ignored       int
	Failed        int
	FreedBytes    int64
}

type Cleaner struct {
	store  Store
	dir    string
	minAge time.Duration
	logger *slog.Logger
}

func NewCleaner(st Store, dir string, minAge time.Duration, logger *slog.Logger) *Cleaner {
	if logger == nil {
		logger = slog.Default()
	}
	return &Cleaner{store: st, dir: dir, minAge: minAge, logger: logger}
}

func (c *Cleaner) Run(ctx context.Context) (Report, error) {
	var report Report

	posts, err := c.store.ListPosts(ctx)
	if err != nil {
		return report, fmt.Errorf("list posts for upload cleanup: %w", err)
	}
	drafts, err := c.store.ListDrafts(ctx)
	if err != nil {
		return report, fmt.Errorf("list drafts for upload cleanup: %w", err)
	}
	about, err := c.store.GetAbout(ctx)
	if err != nil {
		return report, fmt.Errorf("get about page for upload cleanup: %w", err)
	}

	referenced := collectReferences(posts, drafts, about)

	entries, err := os.ReadDir(c.dir)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return report, nil
		}
		return report, fmt.Errorf("read uploads directory: %w", err)
	}

	var failures []error
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := entry.Name()
		if !isManagedUpload(name) {
			report.Ignored++
			continue
		}

		info, err := entry.Info()
		if err != nil {
			report.Failed++
			failures = append(failures, fmt.Errorf("inspect upload %s: %w", name, err))
			continue
		}
		if !info.Mode().IsRegular() {
			continue
		}

		report.Scanned++
		if isReferenced(name, referenced) {
			report.Kept++
			continue
		}
		if c.minAge > 0 && time.Since(info.ModTime()) < c.minAge {
			report.SkippedRecent++
			continue
		}

		if err := os.Remove(filepath.Join(c.dir, name)); err != nil {
			report.Failed++
			failures = append(failures, fmt.Errorf("remove upload %s: %w", name, err))
			c.logger.Error("orphan upload removal failed", "file", name, "error", err)
			continue
		}

		report.Deleted++
		report.FreedBytes += info.Size()
	}

	if len(failures) > 0 {
		return report, errors.Join(failures...)
	}
	return report, nil
}

func collectReferences(posts []domain.Post, drafts []domain.Draft, about *domain.About) map[string]struct{} {
	referenced := make(map[string]struct{})

	for _, post := range posts {
		addReference(referenced, post.Thumbnail)
		addReference(referenced, post.Audio)
		addReferences(referenced, post.Body)
	}
	for _, draft := range drafts {
		addReference(referenced, draft.Thumbnail)
		addReference(referenced, draft.Audio)
		addReferences(referenced, draft.Body)
	}
	if about != nil {
		addReferences(referenced, about.Body)
	}

	return referenced
}

func addReference(referenced map[string]struct{}, value string) {
	addReferences(referenced, value)
}

func addReferences(referenced map[string]struct{}, text string) {
	for _, match := range uploadReference.FindAllString(text, -1) {
		name := strings.TrimPrefix(match, "/uploads/")
		if name != "" {
			referenced[name] = struct{}{}
		}
	}
}

func isReferenced(name string, referenced map[string]struct{}) bool {
	if _, ok := referenced[name]; ok {
		return true
	}
	return isReferencedWaveform(name, referenced)
}

// Waveform sidecars are not stored in the database directly. Keep a sidecar
// while the audio file it belongs to is still referenced.
func isReferencedWaveform(name string, referenced map[string]struct{}) bool {
	if !strings.HasSuffix(name, ".json") {
		return false
	}
	stem := strings.TrimSuffix(name, ".json")
	for _, extension := range audioExtensions {
		if _, ok := referenced[stem+extension]; ok {
			return true
		}
	}
	return false
}

func isManagedUpload(name string) bool {
	return managedUpload.MatchString(name) || strings.HasPrefix(name, ".audio-")
}
