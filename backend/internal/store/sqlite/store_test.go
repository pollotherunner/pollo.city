package sqlite

import (
	"context"
	"errors"
	"path/filepath"
	"testing"

	"pollo.city/internal/store"
)

func TestPostTagAndDraftLifecycle(t *testing.T) {
	ctx := context.Background()
	instance, err := New(filepath.Join(t.TempDir(), "pollo.db"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer instance.Close()

	seeded, err := instance.ListPosts(ctx)
	if err != nil {
		t.Fatalf("list seeded posts: %v", err)
	}
	if len(seeded) != 4 {
		t.Fatalf("expected 4 seeded posts, got %d", len(seeded))
	}

	created, err := instance.CreatePost(ctx, store.PostInput{
		Title: "Ação e Código",
		Tags:  []string{"Ação", "Código", "Ação"},
		Body:  "## Teste\n\nConteúdo do artigo.",
	})
	if err != nil {
		t.Fatalf("create post: %v", err)
	}
	if created.Slug != "acao-e-codigo" {
		t.Fatalf("unexpected slug: %s", created.Slug)
	}
	if len(created.Tags) != 2 {
		t.Fatalf("expected 2 deduplicated tags, got %v", created.Tags)
	}
	if created.Excerpt != "Teste Conteúdo do artigo." {
		t.Fatalf("unexpected excerpt: %q", created.Excerpt)
	}

	updated, err := instance.UpdatePost(ctx, created.Slug, store.PostInput{
		Title: "Título atualizado",
		Tags:  []string{"Teste"},
		Body:  "Conteúdo atualizado.",
	})
	if err != nil {
		t.Fatalf("update post: %v", err)
	}
	if updated.Slug != created.Slug {
		t.Fatalf("slug changed on update: %s", updated.Slug)
	}
	if updated.Title != "Título atualizado" {
		t.Fatalf("unexpected title: %s", updated.Title)
	}

	comment, err := instance.AddComment(ctx, created.Slug, store.CommentInput{Name: "Pollo", Body: "Comentário de teste."})
	if err != nil {
		t.Fatalf("add comment: %v", err)
	}
	if comment.ID == 0 {
		t.Fatal("expected comment id")
	}
	comments, err := instance.ListComments(ctx, created.Slug)
	if err != nil {
		t.Fatalf("list comments: %v", err)
	}
	if len(comments) != 1 {
		t.Fatalf("expected 1 comment, got %d", len(comments))
	}

	draft, err := instance.CreateDraft(ctx, store.DraftInput{
		PostSlug: created.Slug,
		Title:    "Rascunho",
		Tags:     []string{"Teste"},
		Body:     "Rascunho de teste.",
	})
	if err != nil {
		t.Fatalf("create draft: %v", err)
	}
	if draft.PostSlug != created.Slug {
		t.Fatalf("unexpected draft post slug: %s", draft.PostSlug)
	}
	draft, err = instance.UpdateDraft(ctx, draft.ID, store.DraftInput{
		Title: "Rascunho atualizado",
		Body:  "Rascunho atualizado.",
	})
	if err != nil {
		t.Fatalf("update draft: %v", err)
	}
	if draft.PostSlug != "" {
		t.Fatalf("expected draft to be detached, got %s", draft.PostSlug)
	}

	if err := instance.DeleteDraft(ctx, draft.ID); err != nil {
		t.Fatalf("delete draft: %v", err)
	}
	if err := instance.DeletePost(ctx, created.Slug); err != nil {
		t.Fatalf("delete post: %v", err)
	}
	if _, err := instance.GetPost(ctx, created.Slug); !errors.Is(err, store.ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestSeedRunsOnlyOnce(t *testing.T) {
	ctx := context.Background()
	databasePath := filepath.Join(t.TempDir(), "pollo.db")

	first, err := New(databasePath)
	if err != nil {
		t.Fatalf("open first store: %v", err)
	}
	posts, err := first.ListPosts(ctx)
	if err != nil {
		t.Fatalf("list first posts: %v", err)
	}
	for _, post := range posts {
		if err := first.DeletePost(ctx, post.Slug); err != nil {
			t.Fatalf("delete seed post: %v", err)
		}
	}
	if err := first.Close(); err != nil {
		t.Fatalf("close first store: %v", err)
	}

	second, err := New(databasePath)
	if err != nil {
		t.Fatalf("open second store: %v", err)
	}
	defer second.Close()
	posts, err = second.ListPosts(ctx)
	if err != nil {
		t.Fatalf("list second posts: %v", err)
	}
	if len(posts) != 0 {
		t.Fatalf("expected seed not to run again, got %d posts", len(posts))
	}
}

func TestNormalizeTagsLimitsAndTruncates(t *testing.T) {
	tags := normalizeTags([]string{
		"  #Ação  ",
		"acao",
		"123456789012345678901234 extra",
		"um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito",
	})
	if len(tags) != 8 {
		t.Fatalf("expected 8 tags, got %d", len(tags))
	}
	if tags[0].Name != "Ação" || tags[0].Slug != "acao" {
		t.Fatalf("unexpected normalized tag: %+v", tags[0])
	}
	if tags[1].Name != "123456789012345678901234" {
		t.Fatalf("tag was not truncated by runes: %q", tags[1].Name)
	}
}
