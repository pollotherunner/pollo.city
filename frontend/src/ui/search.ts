import { api } from "@/api/client";
import type { Post } from "@/api/types";
import { escapeHtml, query } from "@/lib/dom";
import { formatDate } from "@/lib/dates";
import { refreshIcons } from "@/lib/icons";
import { isOffTopic } from "@/lib/sections";
import { normalizeSearch } from "@/lib/strings";

export class SearchDialog {
  private readonly dialog = query<HTMLDialogElement>("#site-search-dialog");
  private readonly input = query<HTMLInputElement>("#site-search-input");
  private readonly results = query<HTMLElement>("#site-search-results");
  private readonly toggle = query<HTMLButtonElement>(".search-toggle");
  private readonly closeButton = query<HTMLButtonElement>("[data-close-search]");
  private posts: Post[] = [];

  mount(): void {
    this.toggle.addEventListener("click", () => {
      void this.open();
    });

    this.input.addEventListener("input", () => {
      if (this.posts.length) {
        this.render(this.input.value);
      }
    });

    this.input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }
      const firstResult = this.results.querySelector<HTMLAnchorElement>(".search-result");
      if (!firstResult) {
        return;
      }
      event.preventDefault();
      window.location.href = firstResult.href;
    });

    this.dialog.addEventListener("click", (event) => {
      if (event.target === this.dialog) {
        this.dialog.close();
      }
      if (event.target instanceof Element && event.target.closest(".search-result")) {
        this.dialog.close();
      }
    });

    this.dialog.addEventListener("close", () => {
      this.toggle.setAttribute("aria-expanded", "false");
    });

    this.closeButton.addEventListener("click", () => this.dialog.close());
  }

  private async open(): Promise<void> {
    this.input.value = "";
    this.results.innerHTML = '<p class="search-empty">Carregando artigos…</p>';
    this.toggle.setAttribute("aria-expanded", "true");
    this.dialog.showModal();
    window.requestAnimationFrame(() => this.input.focus());

    try {
      this.posts = await api.getPosts();
      this.render(this.input.value);
    } catch {
      this.results.innerHTML = '<p class="search-empty">Não foi possível carregar a busca.</p>';
    }
  }

  private render(queryValue: string): void {
    const term = normalizeSearch(queryValue).trim();
    const matches = this.posts.filter((post) => {
      if (!term) {
        return true;
      }
      return normalizeSearch(`${post.title} ${post.tags.join(" ")} ${post.excerpt} ${post.body}`).includes(term);
    });

    if (!matches.length) {
      this.results.innerHTML = '<p class="search-empty">Nenhum artigo encontrado.</p>';
      return;
    }

    this.results.innerHTML = matches
      .map(
        (post) => `<a class="search-result" href="/post/${encodeURIComponent(post.slug)}">
          <span class="search-result-copy">
            <span class="search-result-title">${escapeHtml(post.title)}</span>
            <span class="search-result-meta">${
              isOffTopic(post.section) ? '<span class="search-section-badge">Off-Topic</span>' : ""
            }${post.tags
              .slice(0, 3)
              .map((tag) => `<span>${escapeHtml(tag)}</span>`)
              .join("")}<time datetime="${escapeHtml(post.date)}">${formatDate(post.date)}</time></span>
          </span>
          <i data-lucide="arrow-up-right" aria-hidden="true"></i>
        </a>`,
      )
      .join("");
    refreshIcons(this.results);
  }
}
