import { api } from "@/api/client";
import type { Post, Tag } from "@/api/types";
import { DEFAULT_THUMBNAIL } from "@/lib/constants";
import { query } from "@/lib/dom";
import { refreshIcons } from "@/lib/icons";
import { buildTags, renderPostRow, renderTagFilter } from "@/lib/post-list";
import { tagSlug } from "@/lib/tags";
import { mountSiteChrome } from "@/ui/chrome";

mountSiteChrome();

const list = query<HTMLElement>("#post-list");
const tagFilter = query<HTMLElement>("#tag-filter");
const count = query<HTMLElement>("[data-post-count]");
const activeTag = tagSlug(new URLSearchParams(window.location.search).get("tag") ?? "");

function updateCount(total: number): void {
  count.textContent = `${total} off-topic`;
}

function renderPosts(posts: Post[]): void {
  if (!posts.length) {
    list.innerHTML = `<p class="empty-state">${activeTag ? "Nenhum off-topic com essa tag." : "Nenhum off-topic ainda."}</p>`;
    return;
  }

  list.innerHTML = posts.map((post) => renderPostRow(post, "/off-topic")).join("");

  list.querySelectorAll<HTMLImageElement>(".post-thumb img").forEach((image) => {
    image.addEventListener(
      "error",
      () => {
        image.src = DEFAULT_THUMBNAIL;
      },
      { once: true },
    );
  });

  refreshIcons(list);
}

list.innerHTML = '<p class="empty-state">Carregando off-topic…</p>';

try {
  const allPosts = await api.getPosts();
  const offTopicPosts = allPosts.filter((post) => post.section === "off-topic");
  const tags: Tag[] = buildTags(offTopicPosts);
  const filteredPosts = activeTag
    ? offTopicPosts.filter((post) => post.tags.some((tag) => tagSlug(tag) === activeTag))
    : offTopicPosts;

  updateCount(filteredPosts.length);
  tagFilter.hidden = tags.length === 0;
  tagFilter.innerHTML = renderTagFilter(tags, activeTag, "/off-topic");
  renderPosts(filteredPosts);
} catch {
  updateCount(0);
  list.innerHTML = '<p class="empty-state">Não foi possível carregar os off-topic.</p>';
}
