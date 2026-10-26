package auth

import (
	"context"
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"pollo.city/internal/store"
)

var ErrInvalidCredentials = errors.New("invalid credentials")

type Service struct {
	store        store.Store
	passwordHash [32]byte
	sessionKey   string
	sessionTTL   time.Duration
}

const sessionKeySalt = "pollo.city/admin-session/v1"

func New(st store.Store, password string, sessionTTL time.Duration) *Service {
	passwordHash := sha256.Sum256([]byte(password))
	sessionKey, err := pbkdf2.Key(sha256.New, password, []byte(sessionKeySalt), 120_000, 32)
	if err != nil {
		// Invalid output sizes are rejected by the constructor arguments, so
		// this can only happen if the standard library contract changes.
		panic(fmt.Sprintf("derive session key: %v", err))
	}
	return &Service{
		store:        st,
		passwordHash: passwordHash,
		sessionKey:   hex.EncodeToString(sessionKey),
		sessionTTL:   sessionTTL,
	}
}

func (s *Service) Login(ctx context.Context, password string) (string, time.Time, error) {
	candidate := sha256.Sum256([]byte(password))
	if subtle.ConstantTimeCompare(candidate[:], s.passwordHash[:]) != 1 {
		return "", time.Time{}, ErrInvalidCredentials
	}

	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", time.Time{}, fmt.Errorf("generate session token: %w", err)
	}
	token := base64.RawURLEncoding.EncodeToString(raw)
	expiresAt := time.Now().UTC().Add(s.sessionTTL)

	now := time.Now().UTC()
	if err := s.store.DeleteExpiredSessions(ctx, now); err != nil {
		return "", time.Time{}, err
	}
	if err := s.store.CreateSession(ctx, hashToken(token), s.sessionKey, expiresAt); err != nil {
		return "", time.Time{}, err
	}
	return token, expiresAt, nil
}

func (s *Service) Authenticate(ctx context.Context, token string) (bool, error) {
	if token == "" {
		return false, nil
	}
	return s.store.SessionExists(ctx, hashToken(token), s.sessionKey, time.Now().UTC())
}

func (s *Service) Logout(ctx context.Context, token string) error {
	if token == "" {
		return nil
	}
	return s.store.DeleteSession(ctx, hashToken(token))
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
