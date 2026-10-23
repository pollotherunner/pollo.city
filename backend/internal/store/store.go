package store

import (
	"context"
	"errors"
	"time"

	"pollo.city/internal/domain"
)

var (
	ErrNotFound = errors.New("not found")
	ErrConflict = errors.New("conflict")
)

type PostInput struct {
	Title     string
	Excerpt   string
	Tags      []string
	Thumbnail string
	Body      string
}

type DraftInput struct {
	PostSlug  string
	Title     string
	Tags      []string
	Thumbnail string
	Body      string
}

type CommentInput struct {
	Name string
	Body string
}

type Store interface {
	Ping(ctx context.Context) error
	Close() error

	ListPosts(ctx context.Context) ([]domain.Post, error)
	GetPost(ctx context.Context, slug string) (*domain.Post, error)
	CreatePost(ctx context.Context, input PostInput) (*domain.Post, error)
	UpdatePost(ctx context.Context, slug string, input PostInput) (*domain.Post, error)
	DeletePost(ctx context.Context, slug string) error

	ListTags(ctx context.Context) ([]domain.Tag, error)

	ListComments(ctx context.Context, postSlug string) ([]domain.Comment, error)
	AddComment(ctx context.Context, postSlug string, input CommentInput) (*domain.Comment, error)

	ListDrafts(ctx context.Context) ([]domain.Draft, error)
	GetDraft(ctx context.Context, id string) (*domain.Draft, error)
	CreateDraft(ctx context.Context, input DraftInput) (*domain.Draft, error)
	UpdateDraft(ctx context.Context, id string, input DraftInput) (*domain.Draft, error)
	DeleteDraft(ctx context.Context, id string) error

	CreateSession(ctx context.Context, tokenHash string, expiresAt time.Time) error
	SessionExists(ctx context.Context, tokenHash string, now time.Time) (bool, error)
	DeleteSession(ctx context.Context, tokenHash string) error
	DeleteExpiredSessions(ctx context.Context, now time.Time) error

	Export(ctx context.Context) (*domain.Backup, error)
	Import(ctx context.Context, backup *domain.Backup) error
}
