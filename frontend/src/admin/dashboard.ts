import { api } from "@/api/client";
import type { Draft, Post, Section } from "@/api/types";
import { byId, escapeHtml } from "@/lib/dom";
import { formatDate, formatDateTime } from "@/lib/dates";
import { refreshIcons } from "@/lib/icons";
import { DEFAULT_THUMBNAIL } from "@/lib/constants";
import { isOffTopic } from "@/lib/sections";

interface DashboardCallbacks {
  onNewArticle(): void;
  onEditPost(slug: string): Promise<void> | void;
  onContinueDraft(draft: Draft): Promise<void> | void;
  onEditAbout(): void;
  onError(message: string): void;
}

export class Dashboard {
  private readonly publishedList = byId<HTMLElement>("published-list");
  private readonly draftsList = byId<HTMLElement>("drafts-list");
  private readonly publishedCount = byId<HTMLElement>("published-count");
  private readonly draftsCount = byId<HTMLElement>("drafts-count");
  private readonly newArticleButton = byId<HTMLButtonElement>("new-article-button");
  private readonly editAboutButton = byId<HTMLButtonElement>("edit-about-button");
  private readonly sectionFilter = byId<HTMLSelectElement>("section-filter");

  private posts: Post[] = [];
  private drafts: Draft[] = [];
  private selectedSection: Section | "all" = "all";

  constructor(private readonly callbacks: DashboardCallbacks) {}

  mount(): void {
    this.newArticleButton.addEventListener("click", () => this.callbacks.onNewArticle());
    this.editAboutButton.addEventListener("click", () => this.callbacks.onEditAbout());
    this.sectionFilter.addEventListener("change", () => {
      this.selectedSection =
        this.sectionFilter.value === "article" || this.sectionFilter.value === "off-topic"
          ? this.sectionFilter.value
          : "all";
      this.render();
    });
    this.publishedList.addEventListener("click", (event) => {
      void this.handlePostAction(event);
    });
    this.draftsList.addEventListener("click", (event) => {
      void this.handleDraftAction(event);
    });
  }

  async refresh(): Promise<void> {
    try {
      [this.posts, this.drafts] = await Promise.all([api.getPosts(), api.getDrafts()]);
      this.render();
    } catch {
      this.posts = [];
      this.drafts = [];
      this.publishedCount.textContent = "0";
      this.draftsCount.textContent = "0";
      this.publishedList.innerHTML = '<p class="admin-empty">Não foi possível carregar os artigos.</p>';
      this.draftsList.innerHTML = '<p class="admin-empty">Não foi possível carregar os rascunhos.</p>';
    }
    refreshIcons();
  }

  private render(): void {
    const matches = <T extends { section: Section }>(items: T[]): T[] =>
      this.selectedSection === "all" ? items : items.filter((item) => item.section === this.selectedSection);

    this.renderPosts(matches(this.posts));
    this.renderDrafts(matches(this.drafts));
    refreshIcons();
  }

  private sectionBadge(section: Section): string {
    return isOffTopic(section) ? '<span class="admin-section-badge">Off-Topic</span>' : "";
  }

  private renderPosts(posts: Post[]): void {
    this.publishedCount.textContent = String(posts.length);
    this.publishedList.innerHTML = posts.length
      ? posts
          .map(
            (post) => `<article class="admin-item">
              <img class="admin-item-thumb" src="${escapeHtml(post.thumbnail || DEFAULT_THUMBNAIL)}" alt="" loading="lazy">
              <div class="admin-item-copy">
                <h3 class="admin-item-title">${escapeHtml(post.title)}</h3>
                <p class="admin-item-meta">${this.sectionBadge(post.section)}${post.tags
                  .map((tag) => `<span>${escapeHtml(tag)}</span>`)
                  .join("")}<time datetime="${escapeHtml(post.date)}">${formatDate(post.date)}</time></p>
              </div>
              <div class="admin-item-actions">
                <a href="/post/${encodeURIComponent(post.slug)}">Ver</a>
                <button type="button" data-action="edit" data-slug="${escapeHtml(post.slug)}">Editar</button>
                <button type="button" data-action="delete" data-slug="${escapeHtml(post.slug)}">Excluir</button>
              </div>
            </article>`,
          )
          .join("")
      : '<p class="admin-empty">Nenhum artigo nesta seção.</p>';
  }

  private renderDrafts(drafts: Draft[]): void {
    this.draftsCount.textContent = String(drafts.length);
    this.draftsList.innerHTML = drafts.length
      ? drafts
          .map(
            (draft) => `<article class="admin-item">
              <img class="admin-item-thumb" src="${escapeHtml(draft.thumbnail || DEFAULT_THUMBNAIL)}" alt="" loading="lazy">
              <div class="admin-item-copy">
                <h3 class="admin-item-title">${escapeHtml(draft.title || "Sem título")}</h3>
                <p class="admin-item-meta">${this.sectionBadge(draft.section)}${draft.tags
                  .map((tag) => `<span>${escapeHtml(tag)}</span>`)
                  .join("")}<span>Rascunho</span><span>${formatDateTime(draft.updatedAt)}</span></p>
              </div>
              <div class="admin-item-actions">
                <button type="button" data-action="continue" data-draft="${escapeHtml(draft.id)}">Continuar</button>
                <button type="button" data-action="delete-draft" data-draft="${escapeHtml(draft.id)}">Excluir</button>
              </div>
            </article>`,
          )
          .join("")
      : '<p class="admin-empty">Nenhum rascunho nesta seção.</p>';
  }

  private async handlePostAction(event: MouseEvent): Promise<void> {
    if (!(event.target instanceof Element)) {
      return;
    }
    const button = event.target.closest<HTMLButtonElement>("[data-action]");
    if (!button) {
      return;
    }

    const slug = button.dataset.slug;
    if (!slug) {
      return;
    }

    if (button.dataset.action === "edit") {
      await this.callbacks.onEditPost(slug);
      return;
    }

    if (button.dataset.action !== "delete") {
      return;
    }

    try {
      const post = await api.getPost(slug);
      if (!post || !window.confirm(`Excluir "${post.title}"?`)) {
        return;
      }
      await api.deletePost(slug);
      await this.refresh();
    } catch {
      this.callbacks.onError("Não foi possível excluir o artigo.");
    }
  }

  private async handleDraftAction(event: MouseEvent): Promise<void> {
    if (!(event.target instanceof Element)) {
      return;
    }
    const button = event.target.closest<HTMLButtonElement>("[data-action]");
    if (!button) {
      return;
    }

    const draftId = button.dataset.draft;
    if (!draftId) {
      return;
    }

    if (button.dataset.action === "continue") {
      try {
        const draft = (await api.getDrafts()).find((item) => item.id === draftId);
        if (draft) {
          await this.callbacks.onContinueDraft(draft);
        }
      } catch {
        this.callbacks.onError("Não foi possível abrir o rascunho.");
      }
      return;
    }

    if (button.dataset.action !== "delete-draft" || !window.confirm("Excluir este rascunho?")) {
      return;
    }

    try {
      await api.deleteDraft(draftId);
      await this.refresh();
    } catch {
      this.callbacks.onError("Não foi possível excluir o rascunho.");
    }
  }
}
