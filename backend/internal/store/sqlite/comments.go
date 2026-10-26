package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"pollo.city/internal/domain"
	"pollo.city/internal/store"
)

func (s *Store) ListComments(ctx context.Context, postSlug string) ([]domain.Comment, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT c.id, c.name, c.body, c.created_at
		FROM comments c
		JOIN posts p ON p.id = c.post_id
		WHERE p.slug = ?
		ORDER BY julianday(c.created_at) ASC, c.id ASC`, postSlug)
	if err != nil {
		return nil, fmt.Errorf("list comments: %w", err)
	}
	defer rows.Close()

	comments := make([]domain.Comment, 0)
	for rows.Next() {
		var comment domain.Comment
		var createdAt string
		if err := rows.Scan(&comment.ID, &comment.Name, &comment.Body, &createdAt); err != nil {
			return nil, fmt.Errorf("scan comment: %w", err)
		}
		date, err := parseStoredTime(createdAt)
		if err != nil {
			return nil, fmt.Errorf("parse comment date: %w", err)
		}
		comment.Date = date
		comments = append(comments, comment)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate comments: %w", err)
	}
	return comments, nil
}

func (s *Store) AddComment(ctx context.Context, postSlug string, input store.CommentInput) (*domain.Comment, error) {
	s.contentMu.Lock()
	defer s.contentMu.Unlock()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin add comment: %w", err)
	}
	defer tx.Rollback()

	var postID int64
	if err := tx.QueryRowContext(ctx, "SELECT id FROM posts WHERE slug = ?", postSlug).Scan(&postID); errors.Is(err, sql.ErrNoRows) {
		return nil, store.ErrNotFound
	} else if err != nil {
		return nil, fmt.Errorf("find post for comment: %w", err)
	}

	now := time.Now().UTC()
	result, err := tx.ExecContext(ctx, "INSERT INTO comments (post_id, name, body, created_at) VALUES (?, ?, ?, ?)",
		postID, input.Name, input.Body, timeString(now))
	if err != nil {
		return nil, fmt.Errorf("insert comment: %w", err)
	}
	id, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("comment id: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit add comment: %w", err)
	}
	return &domain.Comment{ID: id, Name: input.Name, Body: input.Body, Date: now}, nil
}
