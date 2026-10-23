package sqlite

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

type seedFile struct {
	Posts []seedPost `json:"posts"`
}

type seedPost struct {
	Slug      string        `json:"slug"`
	Title     string        `json:"title"`
	Excerpt   string        `json:"excerpt"`
	Tags      []string      `json:"tags"`
	Date      string        `json:"date"`
	Thumbnail string        `json:"thumbnail"`
	Body      string        `json:"body"`
	Comments  []seedComment `json:"comments"`
}

type seedComment struct {
	Name string `json:"name"`
	Body string `json:"body"`
	Date string `json:"date"`
}

func (s *Store) seed(ctx context.Context) error {
	var seeded int
	if err := s.db.QueryRowContext(ctx, "SELECT COUNT(1) FROM app_meta WHERE key = 'seeded'").Scan(&seeded); err != nil {
		return fmt.Errorf("check seed marker: %w", err)
	}
	if seeded > 0 {
		return nil
	}

	var count int
	if err := s.db.QueryRowContext(ctx, "SELECT COUNT(1) FROM posts").Scan(&count); err != nil {
		return fmt.Errorf("count posts for seed: %w", err)
	}
	if count > 0 {
		if _, err := s.db.ExecContext(ctx, "INSERT OR IGNORE INTO app_meta (key, value) VALUES ('seeded', '1')"); err != nil {
			return fmt.Errorf("record existing seed: %w", err)
		}
		return nil
	}

	raw, err := seedFS.ReadFile("seed.json")
	if err != nil {
		return fmt.Errorf("read seed file: %w", err)
	}
	var seed seedFile
	if err := json.Unmarshal(raw, &seed); err != nil {
		return fmt.Errorf("parse seed file: %w", err)
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin seed: %w", err)
	}
	defer tx.Rollback()

	for _, post := range seed.Posts {
		publishedAt, err := parseDateOnly(post.Date)
		if err != nil {
			return fmt.Errorf("parse seed date for %s: %w", post.Slug, err)
		}
		result, err := tx.ExecContext(ctx, `INSERT INTO posts
			(slug, title, excerpt, body_markdown, thumbnail_url, published_at, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			post.Slug, post.Title, post.Excerpt, post.Body, post.Thumbnail,
			timeString(publishedAt), timeString(publishedAt), timeString(publishedAt))
		if err != nil {
			return fmt.Errorf("insert seed post %s: %w", post.Slug, err)
		}
		postID, err := result.LastInsertId()
		if err != nil {
			return fmt.Errorf("seed post id %s: %w", post.Slug, err)
		}
		if err := setPostTags(ctx, tx, postID, post.Tags); err != nil {
			return fmt.Errorf("seed tags for %s: %w", post.Slug, err)
		}

		for _, comment := range post.Comments {
			createdAt, err := time.ParseInLocation("2006-01-02T15:04:05", comment.Date, time.Local)
			if err != nil {
				return fmt.Errorf("parse seed comment date for %s: %w", post.Slug, err)
			}
			if _, err := tx.ExecContext(ctx, `INSERT INTO comments (post_id, name, body, created_at)
				VALUES (?, ?, ?, ?)`, postID, comment.Name, comment.Body, timeString(createdAt)); err != nil {
				return fmt.Errorf("insert seed comment for %s: %w", post.Slug, err)
			}
		}
	}

	if _, err := tx.ExecContext(ctx, "INSERT INTO app_meta (key, value) VALUES ('seeded', '1')"); err != nil {
		return fmt.Errorf("record seed marker: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit seed: %w", err)
	}
	return nil
}
