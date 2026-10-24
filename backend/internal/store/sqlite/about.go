package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"pollo.city/internal/domain"
	"pollo.city/internal/store"
)

const (
	defaultAboutTitle = "Sobre"
	defaultAboutLede  = "pollo.city é o blog pessoal de Pollo."
)

type execer interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

func (s *Store) GetAbout(ctx context.Context) (*domain.About, error) {
	var about domain.About
	var body string
	var updatedAt string
	err := s.db.QueryRowContext(ctx, "SELECT title, lede, body_markdown, updated_at FROM about WHERE id = 1").
		Scan(&about.Title, &about.Lede, &body, &updatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return &domain.About{Title: defaultAboutTitle, Lede: defaultAboutLede}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get about page: %w", err)
	}
	about.Body = body
	about.UpdatedAt = updatedAt
	return &about, nil
}

func (s *Store) UpdateAbout(ctx context.Context, input store.AboutInput) (*domain.About, error) {
	if err := upsertAbout(ctx, s.db, input); err != nil {
		return nil, err
	}
	return s.GetAbout(ctx)
}

func upsertAbout(ctx context.Context, database execer, input store.AboutInput) error {
	if _, err := database.ExecContext(ctx, `INSERT INTO about (id, title, lede, body_markdown, updated_at)
		VALUES (1, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			title = excluded.title,
			lede = excluded.lede,
			body_markdown = excluded.body_markdown,
			updated_at = excluded.updated_at`,
		input.Title, input.Lede, input.Body, nowString()); err != nil {
		return fmt.Errorf("update about page: %w", err)
	}
	return nil
}
