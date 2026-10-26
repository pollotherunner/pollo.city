package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"pollo.city/internal/domain"
	"pollo.city/internal/store"
)

func (s *Store) ListDrafts(ctx context.Context) ([]domain.Draft, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT d.id, COALESCE(p.slug, ''), d.title, d.excerpt, d.body_markdown, d.thumbnail_url, d.section, d.audio_url, d.updated_at
		FROM drafts d
		LEFT JOIN posts p ON p.id = d.post_id
		ORDER BY julianday(d.updated_at) DESC`)
	if err != nil {
		return nil, fmt.Errorf("list drafts: %w", err)
	}
	defer rows.Close()

	drafts := make([]domain.Draft, 0)
	ids := make([]string, 0)
	for rows.Next() {
		var draft domain.Draft
		var updatedAt string
		if err := rows.Scan(&draft.ID, &draft.PostSlug, &draft.Title, &draft.Excerpt, &draft.Body, &draft.Thumbnail, &draft.Section, &draft.Audio, &updatedAt); err != nil {
			return nil, fmt.Errorf("scan draft: %w", err)
		}
		date, err := parseStoredTime(updatedAt)
		if err != nil {
			return nil, fmt.Errorf("parse draft date: %w", err)
		}
		draft.UpdatedAt = date
		draft.Tags = []string{}
		drafts = append(drafts, draft)
		ids = append(ids, draft.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate drafts: %w", err)
	}

	tags, err := s.tagsForDrafts(ctx, ids)
	if err != nil {
		return nil, err
	}
	for index := range drafts {
		if values, ok := tags[drafts[index].ID]; ok {
			drafts[index].Tags = values
		}
	}
	return drafts, nil
}

func (s *Store) GetDraft(ctx context.Context, id string) (*domain.Draft, error) {
	var draft domain.Draft
	var updatedAt string
	err := s.db.QueryRowContext(ctx, `SELECT d.id, COALESCE(p.slug, ''), d.title, d.excerpt, d.body_markdown, d.thumbnail_url, d.section, d.audio_url, d.updated_at
		FROM drafts d
		LEFT JOIN posts p ON p.id = d.post_id
		WHERE d.id = ?`, id).
		Scan(&draft.ID, &draft.PostSlug, &draft.Title, &draft.Excerpt, &draft.Body, &draft.Thumbnail, &draft.Section, &draft.Audio, &updatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, store.ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get draft: %w", err)
	}
	date, err := parseStoredTime(updatedAt)
	if err != nil {
		return nil, fmt.Errorf("parse draft date: %w", err)
	}
	draft.UpdatedAt = date
	draft.Tags = []string{}
	tags, err := s.tagsForDrafts(ctx, []string{id})
	if err != nil {
		return nil, err
	}
	if values, ok := tags[id]; ok {
		draft.Tags = values
	}
	return &draft, nil
}

func (s *Store) CreateDraft(ctx context.Context, input store.DraftInput) (*domain.Draft, error) {
	s.contentMu.Lock()
	defer s.contentMu.Unlock()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin create draft: %w", err)
	}
	defer tx.Rollback()

	id, err := randomID(16)
	if err != nil {
		return nil, err
	}
	postID, err := resolvePostID(ctx, tx, input.PostSlug)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	if _, err := tx.ExecContext(ctx, `INSERT INTO drafts
		(id, post_id, title, excerpt, body_markdown, thumbnail_url, section, audio_url, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, postID, strings.TrimSpace(input.Title), strings.TrimSpace(input.Excerpt), input.Body, input.Thumbnail,
		domain.NormalizeSection(input.Section), strings.TrimSpace(input.Audio), timeString(now), timeString(now)); err != nil {
		return nil, fmt.Errorf("insert draft: %w", err)
	}
	if err := setDraftTags(ctx, tx, id, input.Tags); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit create draft: %w", err)
	}
	return s.GetDraft(ctx, id)
}

func (s *Store) UpdateDraft(ctx context.Context, id string, input store.DraftInput) (*domain.Draft, error) {
	s.contentMu.Lock()
	defer s.contentMu.Unlock()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin update draft: %w", err)
	}
	defer tx.Rollback()

	var exists int
	if err := tx.QueryRowContext(ctx, "SELECT COUNT(1) FROM drafts WHERE id = ?", id).Scan(&exists); err != nil {
		return nil, fmt.Errorf("find draft: %w", err)
	}
	if exists == 0 {
		return nil, store.ErrNotFound
	}
	postID, err := resolvePostID(ctx, tx, input.PostSlug)
	if err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE drafts
		SET post_id = ?, title = ?, excerpt = ?, body_markdown = ?, thumbnail_url = ?, section = ?, audio_url = ?, updated_at = ?
		WHERE id = ?`,
		postID, strings.TrimSpace(input.Title), strings.TrimSpace(input.Excerpt), input.Body, input.Thumbnail,
		domain.NormalizeSection(input.Section), strings.TrimSpace(input.Audio), nowString(), id); err != nil {
		return nil, fmt.Errorf("update draft: %w", err)
	}
	if err := setDraftTags(ctx, tx, id, input.Tags); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit update draft: %w", err)
	}
	return s.GetDraft(ctx, id)
}

func (s *Store) DeleteDraft(ctx context.Context, id string) error {
	s.contentMu.Lock()
	defer s.contentMu.Unlock()

	result, err := s.db.ExecContext(ctx, "DELETE FROM drafts WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete draft: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("draft rows affected: %w", err)
	}
	if affected == 0 {
		return store.ErrNotFound
	}
	return nil
}

func resolvePostID(ctx context.Context, tx *sql.Tx, slug string) (any, error) {
	if strings.TrimSpace(slug) == "" {
		return nil, nil
	}
	var id int64
	if err := tx.QueryRowContext(ctx, "SELECT id FROM posts WHERE slug = ?", slug).Scan(&id); errors.Is(err, sql.ErrNoRows) {
		return nil, store.ErrNotFound
	} else if err != nil {
		return nil, fmt.Errorf("find draft post: %w", err)
	}
	return id, nil
}

func setDraftTags(ctx context.Context, tx *sql.Tx, draftID string, values []string) error {
	if _, err := tx.ExecContext(ctx, "DELETE FROM draft_tags WHERE draft_id = ?", draftID); err != nil {
		return fmt.Errorf("clear draft tags: %w", err)
	}
	for _, tag := range normalizeTags(values) {
		if _, err := tx.ExecContext(ctx, "INSERT INTO tags (name, slug) VALUES (?, ?) ON CONFLICT(slug) DO NOTHING", tag.Name, tag.Slug); err != nil {
			return fmt.Errorf("insert draft tag: %w", err)
		}
		var tagID int64
		if err := tx.QueryRowContext(ctx, "SELECT id FROM tags WHERE slug = ?", tag.Slug).Scan(&tagID); err != nil {
			return fmt.Errorf("find draft tag: %w", err)
		}
		if _, err := tx.ExecContext(ctx, "INSERT INTO draft_tags (draft_id, tag_id) VALUES (?, ?)", draftID, tagID); err != nil {
			return fmt.Errorf("link draft tag: %w", err)
		}
	}
	return nil
}

func (s *Store) tagsForDrafts(ctx context.Context, ids []string) (map[string][]string, error) {
	result := make(map[string][]string)
	if len(ids) == 0 {
		return result, nil
	}

	placeholders := make([]string, len(ids))
	args := make([]any, len(ids))
	for index, id := range ids {
		placeholders[index] = "?"
		args[index] = id
	}
	query := fmt.Sprintf(`SELECT dt.draft_id, t.name
		FROM draft_tags dt
		JOIN tags t ON t.id = dt.tag_id
		WHERE dt.draft_id IN (%s)
		ORDER BY t.name COLLATE NOCASE ASC`, strings.Join(placeholders, ","))
	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("load draft tags: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			return nil, fmt.Errorf("scan draft tag: %w", err)
		}
		result[id] = append(result[id], name)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate draft tags: %w", err)
	}
	return result, nil
}
