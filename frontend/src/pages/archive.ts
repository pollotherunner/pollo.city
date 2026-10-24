import { api } from "@/api/client";
import type { Post } from "@/api/types";
import { escapeHtml, query } from "@/lib/dom";
import { formatDate } from "@/lib/dates";
import { refreshIcons } from "@/lib/icons";
import { mountSiteChrome } from "@/ui/chrome";

mountSiteChrome();

const list = query<HTMLElement>("#archive-list");
const count = query<HTMLElement>("#archive-count");

function renderArchive(posts: Post[]): void {
  count.textContent = `${posts.length} ${posts.length === 1 ? "artigo" : "artigos"}`;

  if (!posts.length) {
    list.innerHTML = '<p class="archive-empty">Nenhum artigo publicado.</p>';
    return;
  }

  const groups = new Map<string, Post[]>();
  posts.forEach((post) => {
    const year = post.date.slice(0, 4) || "Sem data";
    const group = groups.get(year) ?? [];
    group.push(post);
    groups.set(year, group);
  });

  list.innerHTML = [...groups.entries()]
    .sort(([first], [second]) => second.localeCompare(first))
    .map(
      ([year, items]) => `<section class="archive-group">
        <h2 class="archive-year">${escapeHtml(year)}</h2>
        <ul class="archive-items">
          ${items
            .map(
              (post) => `<li>
                <a class="archive-item" href="/post/${encodeURIComponent(post.slug)}">
                  <span class="archive-item-title">${escapeHtml(post.title)}</span>
                  <span class="archive-item-meta">${post.tags
                    .slice(0, 3)
                    .map((tag) => `<span>${escapeHtml(tag)}</span>`)
                    .join("")}<time datetime="${escapeHtml(post.date)}">${formatDate(post.date)}</time></span>
                </a>
              </li>`,
            )
            .join("")}
        </ul>
      </section>`,
    )
    .join("");

  refreshIcons(list);
}

try {
  renderArchive(await api.getPosts());
} catch {
  count.textContent = "";
  list.innerHTML = '<p class="archive-empty">Não foi possível carregar o arquivo.</p>';
}
