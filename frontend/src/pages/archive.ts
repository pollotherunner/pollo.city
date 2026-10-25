import { api } from "@/api/client";
import type { Post, Section } from "@/api/types";
import { escapeHtml, query } from "@/lib/dom";
import { formatDate } from "@/lib/dates";
import { refreshIcons } from "@/lib/icons";
import { isOffTopic } from "@/lib/sections";
import { mountSiteChrome } from "@/ui/chrome";

mountSiteChrome();

const list = query<HTMLElement>("#archive-list");
const count = query<HTMLElement>("#archive-count");
const filter = query<HTMLElement>("#archive-filter");

type ArchiveFilter = Section | "all";

function requestedFilter(): ArchiveFilter {
  const value = new URLSearchParams(window.location.search).get("secao");
  return value === "article" || value === "off-topic" ? value : "all";
}

function filterLink(href: string, label: string, active: boolean): string {
  return `<a class="tag-filter-link${active ? " is-active" : ""}" href="${href}"${active ? ' aria-current="page"' : ""}>${label}</a>`;
}

function renderFilter(active: ArchiveFilter): void {
  filter.innerHTML = [
    filterLink("/arquivo", "Tudo", active === "all"),
    filterLink("/arquivo?secao=article", "Artigos", active === "article"),
    filterLink("/arquivo?secao=off-topic", "Off-Topic", active === "off-topic"),
  ].join("");
}

function countLabel(total: number, section: ArchiveFilter): string {
  if (section === "article") {
    return `${total} ${total === 1 ? "artigo" : "artigos"}`;
  }
  if (section === "off-topic") {
    return `${total} off-topic`;
  }
  return `${total} ${total === 1 ? "publicação" : "publicações"}`;
}

function renderArchive(posts: Post[], section: ArchiveFilter): void {
  const filtered = section === "all" ? posts : posts.filter((post) => post.section === section);
  count.textContent = countLabel(filtered.length, section);

  if (!filtered.length) {
    list.innerHTML = '<p class="archive-empty">Nenhuma publicação nesta seção.</p>';
    return;
  }

  const groups = new Map<string, Post[]>();
  filtered.forEach((post) => {
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
                  <span class="archive-item-meta">${
                    isOffTopic(post.section) ? '<span class="archive-section-badge">Off-Topic</span>' : ""
                  }${post.tags
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

const activeFilter = requestedFilter();
renderFilter(activeFilter);

try {
  renderArchive(await api.getPosts(), activeFilter);
} catch {
  count.textContent = "";
  list.innerHTML = '<p class="archive-empty">Não foi possível carregar o arquivo.</p>';
}
