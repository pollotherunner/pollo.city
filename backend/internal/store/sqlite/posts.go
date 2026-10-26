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

func (s *Store) ListPosts(ctx context.Context) ([]domain.Post, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, slug, title, excerpt, body_markdown, thumbnail_url, published_at, section, audio_url
		FROM posts ORDER BY julianday(published_at) DESC, id DESC`)
	if err != nil {
		return nil, fmt.Errorf("list posts: %w", err)
	}
	defer rows.Close()

	posts := make([]domain.Post, 0)
	ids := make([]int64, 0)
	for rows.Next() {
		var id int64
		var post domain.Post
		var publishedAt string
		if err := rows.Scan(&id, &post.Slug, &post.Title, &post.Excerpt, &post.Body, &post.Thumbnail, &publishedAt, &post.Section, &post.Audio); err != nil {
			return nil, fmt.Errorf("scan post: %w", err)
		}
		date, err := parseStoredTime(publishedAt)
		if err != nil {
			return nil, fmt.Errorf("parse post date: %w", err)
		}
		post.Date = dateOnly(date)
		post.Tags = []string{}
		posts = append(posts, post)
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate posts: %w", err)
	}

	tags, err := s.tagsForPosts(ctx, ids)
	if err != nil {
		return nil, err
	}
	for index := range posts {
		if values, ok := tags[ids[index]]; ok {
			posts[index].Tags = values
		}
	}
	return posts, nil
}

func (s *Store) GetPost(ctx context.Context, slug string) (*domain.Post, error) {
	var id int64
	var post domain.Post
	var publishedAt string
	err := s.db.QueryRowContext(ctx, `SELECT id, slug, title, excerpt, body_markdown, thumbnail_url, published_at, section, audio_url
		FROM posts WHERE slug = ?`, slug).
		Scan(&id, &post.Slug, &post.Title, &post.Excerpt, &post.Body, &post.Thumbnail, &publishedAt, &post.Section, &post.Audio)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, store.ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get post: %w", err)
	}
	date, err := parseStoredTime(publishedAt)
	if err != nil {
		return nil, fmt.Errorf("parse post date: %w", err)
	}
	post.Date = dateOnly(date)
	post.Tags = []string{}
	tags, err := s.tagsForPosts(ctx, []int64{id})
	if err != nil {
		return nil, err
	}
	if values, ok := tags[id]; ok {
		post.Tags = values
	}
	return &post, nil
}

func (s *Store) CreatePost(ctx context.Context, input store.PostInput) (*domain.Post, error) {
	s.contentMu.Lock()
	defer s.contentMu.Unlock()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin create post: %w", err)
	}
	defer tx.Rollback()

	slug, err := uniquePostSlug(ctx, tx, input.Title)
	if err != nil {
		return nil, err
	}
	excerpt := strings.TrimSpace(input.Excerpt)
	now := time.Now().UTC()
	result, err := tx.ExecContext(ctx, `INSERT INTO posts
		(slug, title, excerpt, body_markdown, thumbnail_url, section, audio_url, published_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		slug, strings.TrimSpace(input.Title), excerpt, input.Body, input.Thumbnail,
		domain.NormalizeSection(input.Section), strings.TrimSpace(input.Audio),
		timeString(now), timeString(now), timeString(now))
	if err != nil {
		return nil, fmt.Errorf("insert post: %w", err)
	}
	postID, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("post id: %w", err)
	}
	if err := setPostTags(ctx, tx, postID, input.Tags); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit create post: %w", err)
	}
	return s.GetPost(ctx, slug)
}

func (s *Store) UpdatePost(ctx context.Context, slug string, input store.PostInput) (*domain.Post, error) {
	s.contentMu.Lock()
	defer s.contentMu.Unlock()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin update post: %w", err)
	}
	defer tx.Rollback()

	var postID int64
	if err := tx.QueryRowContext(ctx, "SELECT id FROM posts WHERE slug = ?", slug).Scan(&postID); errors.Is(err, sql.ErrNoRows) {
		return nil, store.ErrNotFound
	} else if err != nil {
		return nil, fmt.Errorf("find post for update: %w", err)
	}

	excerpt := strings.TrimSpace(input.Excerpt)
	if _, err := tx.ExecContext(ctx, `UPDATE posts
		SET title = ?, excerpt = ?, body_markdown = ?, thumbnail_url = ?, section = ?, audio_url = ?, updated_at = ?
		WHERE id = ?`,
		strings.TrimSpace(input.Title), excerpt, input.Body, input.Thumbnail,
		domain.NormalizeSection(input.Section), strings.TrimSpace(input.Audio), nowString(), postID); err != nil {
		return nil, fmt.Errorf("update post: %w", err)
	}
	if err := setPostTags(ctx, tx, postID, input.Tags); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit update post: %w", err)
	}
	return s.GetPost(ctx, slug)
}

func (s *Store) DeletePost(ctx context.Context, slug string) error {
	s.contentMu.Lock()
	defer s.contentMu.Unlock()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin delete post: %w", err)
	}
	defer tx.Rollback()

	var postID int64
	if err := tx.QueryRowContext(ctx, "SELECT id FROM posts WHERE slug = ?", slug).Scan(&postID); errors.Is(err, sql.ErrNoRows) {
		return store.ErrNotFound
	} else if err != nil {
		return fmt.Errorf("find post for delete: %w", err)
	}

	if _, err := tx.ExecContext(ctx, "DELETE FROM drafts WHERE post_id = ?", postID); err != nil {
		return fmt.Errorf("delete post drafts: %w", err)
	}
	if _, err := tx.ExecContext(ctx, "DELETE FROM posts WHERE id = ?", postID); err != nil {
		return fmt.Errorf("delete post: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit delete post: %w", err)
	}
	return nil
}

func (s *Store) ListTags(ctx context.Context) ([]domain.Tag, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT t.name, t.slug, COUNT(DISTINCT pt.post_id) AS total
		FROM tags t
		JOIN post_tags pt ON pt.tag_id = t.id
		GROUP BY t.id
		ORDER BY total DESC, t.name COLLATE NOCASE ASC`)
	if err != nil {
		return nil, fmt.Errorf("list tags: %w", err)
	}
	defer rows.Close()

	tags := make([]domain.Tag, 0)
	for rows.Next() {
		var tag domain.Tag
		if err := rows.Scan(&tag.Name, &tag.Slug, &tag.Count); err != nil {
			return nil, fmt.Errorf("scan tag: %w", err)
		}
		tags = append(tags, tag)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate tags: %w", err)
	}
	return tags, nil
}

func uniquePostSlug(ctx context.Context, tx *sql.Tx, title string) (string, error) {
	base := slugify(title, "artigo", 72)
	for suffix := 1; ; suffix++ {
		candidate := base
		if suffix > 1 {
			candidate = fmt.Sprintf("%s-%d", base, suffix)
		}
		var count int
		if err := tx.QueryRowContext(ctx, "SELECT COUNT(1) FROM posts WHERE slug = ?", candidate).Scan(&count); err != nil {
			return "", fmt.Errorf("check post slug: %w", err)
		}
		if count == 0 {
			return candidate, nil
		}
	}
}

func setPostTags(ctx context.Context, tx *sql.Tx, postID int64, values []string) error {
	if _, err := tx.ExecContext(ctx, "DELETE FROM post_tags WHERE post_id = ?", postID); err != nil {
		return fmt.Errorf("clear post tags: %w", err)
	}

	for _, tag := range normalizeTags(values) {
		if _, err := tx.ExecContext(ctx, "INSERT INTO tags (name, slug) VALUES (?, ?) ON CONFLICT(slug) DO NOTHING", tag.Name, tag.Slug); err != nil {
			return fmt.Errorf("insert tag: %w", err)
		}
		var tagID int64
		if err := tx.QueryRowContext(ctx, "SELECT id FROM tags WHERE slug = ?", tag.Slug).Scan(&tagID); err != nil {
			return fmt.Errorf("find tag: %w", err)
		}
		if _, err := tx.ExecContext(ctx, "INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)", postID, tagID); err != nil {
			return fmt.Errorf("link post tag: %w", err)
		}
	}
	return nil
}

func (s *Store) tagsForPosts(ctx context.Context, ids []int64) (map[int64][]string, error) {
	result := make(map[int64][]string)
	if len(ids) == 0 {
		return result, nil
	}

	placeholders := make([]string, len(ids))
	args := make([]any, len(ids))
	for index, id := range ids {
		placeholders[index] = "?"
		args[index] = id
	}

	query := fmt.Sprintf(`SELECT pt.post_id, t.name
		FROM post_tags pt
		JOIN tags t ON t.id = pt.tag_id
		WHERE pt.post_id IN (%s)
		ORDER BY t.name COLLATE NOCASE ASC`, strings.Join(placeholders, ","))
	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("load post tags: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var postID int64
		var name string
		if err := rows.Scan(&postID, &name); err != nil {
			return nil, fmt.Errorf("scan post tag: %w", err)
		}
		result[postID] = append(result[postID], name)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate post tags: %w", err)
	}
	return result, nil
}
