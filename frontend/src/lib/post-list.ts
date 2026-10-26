import type { Post, Tag } from "@/api/types";
import { DEFAULT_THUMBNAIL } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { escapeHtml } from "@/lib/dom";
import { isOffTopic } from "@/lib/sections";
import { readingMinutes } from "@/lib/strings";
import { tagSlug } from "@/lib/tags";

export function buildTags(posts: Post[]): Tag[] {
  const tags = new Map<string, Tag>();

  posts.forEach((post) => {
    post.tags.forEach((name) => {
      const slug = tagSlug(name);
      if (!slug) {
        return;
      }
      const existing = tags.get(slug);
      if (existing) {
        existing.count += 1;
        return;
      }
      tags.set(slug, { name, slug, count: 1 });
    });
  });

  return [...tags.values()].sort(
    (first, second) => second.count - first.count || first.name.localeCompare(second.name, "pt-BR"),
  );
}

export function renderTagFilter(tags: Tag[], activeTag: string, basePath: string): string {
  const allHref = basePath === "/" ? "/" : basePath;
  return [
    `<a class="tag-filter-link${activeTag ? "" : " is-active"}" href="${allHref}"${activeTag ? "" : ' aria-current="true"'}>Todas</a>`,
    ...tags.map((tag) => {
      const active = tag.slug === activeTag;
      const href = `${allHref}?tag=${encodeURIComponent(tag.slug)}`;
      return `<a class="tag-filter-link${active ? " is-active" : ""}" href="${href}"${active ? ' aria-current="true"' : ""}>${escapeHtml(tag.name)}</a>`;
    }),
  ].join("");
}

export function renderPostRow(post: Post, tagBase: string): string {
  const minutes = readingMinutes(post.body);
  const thumbnail = post.thumbnail || DEFAULT_THUMBNAIL;
  const section = isOffTopic(post.section) ? '<span class="post-section-badge">Off-Topic</span>' : "";
  const tagLinks = post.tags.length
    ? `<div class="post-tags">${post.tags
        .map(
          (tag) =>
            `<a class="post-tag" href="${tagBase}?tag=${encodeURIComponent(tagSlug(tag))}">${escapeHtml(tag)}</a>`,
        )
        .join("")}</div>`
    : "";
  const excerpt = post.excerpt ? `<p class="post-excerpt">${escapeHtml(post.excerpt)}</p>` : "";

  return `<article class="post-row">
    <div class="post-thumb">
      <img src="${escapeHtml(thumbnail)}" alt="" loading="lazy">
    </div>
    <div class="post-copy">
      <div class="post-meta">
        <time datetime="${escapeHtml(post.date)}">${formatDate(post.date)}</time>
        ${section}
        ${tagLinks}
      </div>
      <h2 class="post-title"><a class="post-title-link" href="/post/${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></h2>
      ${excerpt}
    </div>
    <div class="post-aside">
      <span class="post-time"><i data-lucide="clock"></i>${minutes} min</span>
      <i class="post-arrow" data-lucide="arrow-up-right"></i>
    </div>
  </article>`;
}
