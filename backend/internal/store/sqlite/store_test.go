package sqlite

import (
	"context"
	"errors"
	"path/filepath"
	"testing"

	"pollo.city/internal/domain"
	"pollo.city/internal/store"
)

func TestPostTagAndDraftLifecycle(t *testing.T) {
	ctx := context.Background()
	instance, err := New(filepath.Join(t.TempDir(), "pollo.db"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer instance.Close()

	initial, err := instance.ListPosts(ctx)
	if err != nil {
		t.Fatalf("list initial posts: %v", err)
	}
	if len(initial) != 0 {
		t.Fatalf("expected an empty database, got %d posts", len(initial))
	}

	about, err := instance.GetAbout(ctx)
	if err != nil {
		t.Fatalf("get default about page: %v", err)
	}
	if about.Title != "Sobre" || about.Body != "" {
		t.Fatalf("unexpected default about page: %+v", about)
	}
	about, err = instance.UpdateAbout(ctx, store.AboutInput{
		Title: "Sobre mim",
		Lede:  "Uma introdução.",
		Body:  "## Conteúdo\n\nTexto da página sobre.",
	})
	if err != nil {
		t.Fatalf("update about page: %v", err)
	}
	if about.Title != "Sobre mim" || about.UpdatedAt == "" {
		t.Fatalf("unexpected updated about page: %+v", about)
	}

	backup, err := instance.Export(ctx)
	if err != nil {
		t.Fatalf("export backup: %v", err)
	}
	if backup.About == nil || backup.About.Title != "Sobre mim" {
		t.Fatalf("about page missing from backup: %+v", backup.About)
	}
	if err := instance.Import(ctx, backup); err != nil {
		t.Fatalf("import backup: %v", err)
	}
	about, err = instance.GetAbout(ctx)
	if err != nil {
		t.Fatalf("get imported about page: %v", err)
	}
	if about.Body != "## Conteúdo\n\nTexto da página sobre." {
		t.Fatalf("unexpected imported about page: %+v", about)
	}

	created, err := instance.CreatePost(ctx, store.PostInput{
		Title:   "Ação e Código",
		Excerpt: "Resumo curto.",
		Tags:    []string{"Ação", "Código", "Ação"},
		Body:    "## Teste\n\nConteúdo do artigo.",
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
	if created.Excerpt != "Resumo curto." {
		t.Fatalf("unexpected excerpt: %q", created.Excerpt)
	}
	if created.Section != domain.SectionArticle {
		t.Fatalf("unexpected default section: %q", created.Section)
	}

	offTopic, err := instance.CreatePost(ctx, store.PostInput{
		Title:   "Fora do tema",
		Body:    "Conteúdo off-topic.",
		Section: domain.SectionOffTopic,
	})
	if err != nil {
		t.Fatalf("create off-topic post: %v", err)
	}
	if offTopic.Section != domain.SectionOffTopic {
		t.Fatalf("unexpected off-topic section: %q", offTopic.Section)
	}
	offTopic, err = instance.UpdatePost(ctx, offTopic.Slug, store.PostInput{
		Title:   "Fora do tema atualizado",
		Body:    "Conteúdo atualizado.",
		Section: domain.SectionArticle,
	})
	if err != nil {
		t.Fatalf("update off-topic post: %v", err)
	}
	if offTopic.Section != domain.SectionArticle {
		t.Fatalf("unexpected updated section: %q", offTopic.Section)
	}
	if err := instance.DeletePost(ctx, offTopic.Slug); err != nil {
		t.Fatalf("delete off-topic post: %v", err)
	}

	withoutExcerpt, err := instance.CreatePost(ctx, store.PostInput{
		Title: "Sem resumo",
		Body:  "Conteúdo sem resumo.",
	})
	if err != nil {
		t.Fatalf("create post without excerpt: %v", err)
	}
	if withoutExcerpt.Excerpt != "" {
		t.Fatalf("expected empty excerpt, got %q", withoutExcerpt.Excerpt)
	}
	if err := instance.DeletePost(ctx, withoutExcerpt.Slug); err != nil {
		t.Fatalf("delete post without excerpt: %v", err)
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
		Excerpt:  "Resumo do rascunho.",
		Tags:     []string{"Teste"},
		Body:     "Rascunho de teste.",
		Section:  domain.SectionOffTopic,
	})
	if err != nil {
		t.Fatalf("create draft: %v", err)
	}
	if draft.PostSlug != created.Slug {
		t.Fatalf("unexpected draft post slug: %s", draft.PostSlug)
	}
	if draft.Excerpt != "Resumo do rascunho." {
		t.Fatalf("unexpected draft excerpt: %q", draft.Excerpt)
	}
	if draft.Section != domain.SectionOffTopic {
		t.Fatalf("unexpected draft section: %q", draft.Section)
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
	if draft.Section != domain.SectionArticle {
		t.Fatalf("unexpected updated draft section: %q", draft.Section)
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

func TestBackupPreservesSections(t *testing.T) {
	ctx := context.Background()
	instance, err := New(filepath.Join(t.TempDir(), "pollo.db"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer instance.Close()

	if _, err := instance.CreatePost(ctx, store.PostInput{
		Title:   "Off-topic de backup",
		Body:    "Conteúdo.",
		Section: domain.SectionOffTopic,
	}); err != nil {
		t.Fatalf("create post: %v", err)
	}
	backup, err := instance.Export(ctx)
	if err != nil {
		t.Fatalf("export backup: %v", err)
	}
	if len(backup.Posts) != 1 || backup.Posts[0].Section != domain.SectionOffTopic {
		t.Fatalf("backup did not preserve section: %+v", backup.Posts)
	}
	if err := instance.Import(ctx, backup); err != nil {
		t.Fatalf("import backup: %v", err)
	}
	posts, err := instance.ListPosts(ctx)
	if err != nil {
		t.Fatalf("list imported posts: %v", err)
	}
	if len(posts) != 1 || posts[0].Section != domain.SectionOffTopic {
		t.Fatalf("import did not preserve section: %+v", posts)
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
