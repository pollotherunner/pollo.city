package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

func (s *Store) CreateSession(ctx context.Context, tokenHash string, expiresAt time.Time) error {
	_, err := s.db.ExecContext(ctx, `INSERT INTO sessions (token_hash, expires_at, created_at)
		VALUES (?, ?, ?)`, tokenHash, timeString(expiresAt), nowString())
	if err != nil {
		return fmt.Errorf("create session: %w", err)
	}
	return nil
}

func (s *Store) SessionExists(ctx context.Context, tokenHash string, now time.Time) (bool, error) {
	var expiresAt string
	err := s.db.QueryRowContext(ctx, "SELECT expires_at FROM sessions WHERE token_hash = ?", tokenHash).Scan(&expiresAt)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("find session: %w", err)
	}
	expires, err := parseStoredTime(expiresAt)
	if err != nil {
		return false, fmt.Errorf("parse session expiry: %w", err)
	}
	return expires.After(now.UTC()), nil
}

func (s *Store) DeleteSession(ctx context.Context, tokenHash string) error {
	if _, err := s.db.ExecContext(ctx, "DELETE FROM sessions WHERE token_hash = ?", tokenHash); err != nil {
		return fmt.Errorf("delete session: %w", err)
	}
	return nil
}

func (s *Store) DeleteExpiredSessions(ctx context.Context, now time.Time) error {
	if _, err := s.db.ExecContext(ctx, "DELETE FROM sessions WHERE julianday(expires_at) <= julianday(?)", timeString(now)); err != nil {
		return fmt.Errorf("delete expired sessions: %w", err)
	}
	return nil
}
