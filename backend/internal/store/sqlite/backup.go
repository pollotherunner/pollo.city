package sqlite

import (
	"context"
	"fmt"
	"strings"
	"time"

	"pollo.city/internal/domain"
	"pollo.city/internal/store"
)

func (s *Store) Export(ctx context.Context) (*domain.Backup, error) {
	posts, err := s.ListPosts(ctx)
	if err != nil {
		return nil, err
	}
	drafts, err := s.ListDrafts(ctx)
	if err != nil {
		return nil, err
	}
	about, err := s.GetAbout(ctx)
	if err != nil {
		return nil, err
	}

	rows, err := s.db.QueryContext(ctx, `SELECT p.slug, c.name, c.body, c.created_at
		FROM comments c
		JOIN posts p ON p.id = c.post_id
		ORDER BY julianday(c.created_at) ASC, c.id ASC`)
	if err != nil {
		return nil, fmt.Errorf("export comments: %w", err)
	}
	defer rows.Close()

	comments := make([]domain.BackupComment, 0)
	for rows.Next() {
		var comment domain.BackupComment
		var createdAt string
		if err := rows.Scan(&comment.PostSlug, &comment.Name, &comment.Body, &createdAt); err != nil {
			return nil, fmt.Errorf("scan export comment: %w", err)
		}
		date, err := parseStoredTime(createdAt)
		if err != nil {
			return nil, fmt.Errorf("parse export comment date: %w", err)
		}
		comment.Date = date
		comments = append(comments, comment)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate export comments: %w", err)
	}

	return &domain.Backup{
		Version:    1,
		ExportedAt: time.Now().UTC(),
		Posts:      posts,
		Comments:   comments,
		Drafts:     drafts,
		About:      about,
	}, nil
}

func (s *Store) Import(ctx context.Context, backup *domain.Backup) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin import: %w", err)
	}
	defer tx.Rollback()

	for _, statement := range []string{
		"DELETE FROM draft_tags",
		"DELETE FROM drafts",
		"DELETE FROM post_tags",
		"DELETE FROM comments",
		"DELETE FROM posts",
		"DELETE FROM tags",
	} {
		if _, err := tx.ExecContext(ctx, statement); err != nil {
			return fmt.Errorf("clear data for import: %w", err)
		}
	}

	postIDs := make(map[string]int64, len(backup.Posts))
	for _, post := range backup.Posts {
		slug := strings.TrimSpace(post.Slug)
		if slug == "" {
			slug = slugify(post.Title, "artigo", 72)
		}
		publishedAt, err := parseDateOnly(post.Date)
		if err != nil {
			publishedAt = time.Now().UTC()
		}
		excerpt := strings.TrimSpace(post.Excerpt)
		result, err := tx.ExecContext(ctx, `INSERT INTO posts
			(slug, title, excerpt, body_markdown, thumbnail_url, section, published_at, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			slug, strings.TrimSpace(post.Title), excerpt, post.Body, post.Thumbnail,
			domain.NormalizeSection(post.Section),
			timeString(publishedAt), timeString(publishedAt), timeString(publishedAt))
		if err != nil {
			return fmt.Errorf("import post %s: %w", slug, err)
		}
		postID, err := result.LastInsertId()
		if err != nil {
			return fmt.Errorf("import post id %s: %w", slug, err)
		}
		postIDs[slug] = postID
		if err := setPostTags(ctx, tx, postID, post.Tags); err != nil {
			return err
		}
	}

	for _, comment := range backup.Comments {
		postID, ok := postIDs[comment.PostSlug]
		if !ok {
			continue
		}
		createdAt := comment.Date
		if createdAt.IsZero() {
			createdAt = time.Now().UTC()
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO comments (post_id, name, body, created_at)
			VALUES (?, ?, ?, ?)`, postID, comment.Name, comment.Body, timeString(createdAt)); err != nil {
			return fmt.Errorf("import comment: %w", err)
		}
	}

	for _, draft := range backup.Drafts {
		id := strings.TrimSpace(draft.ID)
		if id == "" {
			generated, err := randomID(16)
			if err != nil {
				return err
			}
			id = generated
		}
		var postID any
		if value, ok := postIDs[draft.PostSlug]; ok {
			postID = value
		}
		updatedAt := draft.UpdatedAt
		if updatedAt.IsZero() {
			updatedAt = time.Now().UTC()
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO drafts
			(id, post_id, title, excerpt, body_markdown, thumbnail_url, section, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id, postID, draft.Title, draft.Excerpt, draft.Body, draft.Thumbnail,
			domain.NormalizeSection(draft.Section), timeString(updatedAt), timeString(updatedAt)); err != nil {
			return fmt.Errorf("import draft %s: %w", id, err)
		}
		if err := setDraftTags(ctx, tx, id, draft.Tags); err != nil {
			return err
		}
	}

	if backup.About != nil {
		title := strings.TrimSpace(backup.About.Title)
		if title == "" {
			title = defaultAboutTitle
		}
		if err := upsertAbout(ctx, tx, store.AboutInput{
			Title: title,
			Lede:  strings.TrimSpace(backup.About.Lede),
			Body:  backup.About.Body,
		}); err != nil {
			return err
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit import: %w", err)
	}
	return nil
}
