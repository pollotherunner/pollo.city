import { api } from "@/api/client";
import type { Post, Tag } from "@/api/types";
import { createPostsGraph, type PostsGraph } from "@/graph/posts-graph";
import { mountIntro } from "@/intro/intro";
import { escapeHtml, query } from "@/lib/dom";
import { formatDate } from "@/lib/dates";
import { refreshIcons } from "@/lib/icons";
import { readingMinutes } from "@/lib/strings";
import { tagSlug } from "@/lib/tags";
import { mountSiteChrome } from "@/ui/chrome";
import { DEFAULT_THUMBNAIL } from "@/lib/constants";

mountSiteChrome();
mountIntro();

const list = query<HTMLElement>("#post-list");
const tagFilter = query<HTMLElement>("#tag-filter");
const count = query<HTMLElement>("[data-post-count]");
const defaultView = query<HTMLElement>("#default-view");
const graphView = query<HTMLElement>("#graph-view");
const graphCanvas = query<HTMLCanvasElement>("#posts-graph");
const viewButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-view]"));
const siteHeader = query<HTMLElement>(".site-header");
const activeTag = tagSlug(new URLSearchParams(window.location.search).get("tag") ?? "");

let posts: Post[] = [];
let tags: Tag[] = [];
let filteredPosts: Post[] = [];
let graph: PostsGraph | null = null;

function updateCount(total: number): void {
  count.textContent = `${total} ${total === 1 ? "artigo" : "artigos"}`;
}

function updateGraphTop(): void {
  document.documentElement.style.setProperty("--graph-top", `${siteHeader.offsetHeight}px`);
}

function renderTagFilter(): void {
  tagFilter.hidden = tags.length === 0;
  tagFilter.innerHTML = [
    `<a class="tag-filter-link${activeTag ? "" : " is-active"}" href="/"${activeTag ? "" : ' aria-current="true"'}>Todas</a>`,
    ...tags.map((tag) => {
      const active = tag.slug === activeTag;
      return `<a class="tag-filter-link${active ? " is-active" : ""}" href="/?tag=${encodeURIComponent(tag.slug)}"${active ? ' aria-current="true"' : ""}>${escapeHtml(tag.name)}</a>`;
    }),
  ].join("");
}

function renderPosts(): void {
  if (!filteredPosts.length) {
    list.innerHTML = `<p class="empty-state">${activeTag ? "Nenhum artigo com essa tag." : "Nenhum artigo ainda."}</p>`;
    return;
  }

  list.innerHTML = filteredPosts
    .map((post) => {
      const minutes = readingMinutes(post.body);
      const thumbnail = post.thumbnail || DEFAULT_THUMBNAIL;
      const tagLinks = post.tags.length
        ? `<div class="post-tags">${post.tags
            .map(
              (tag) =>
                `<a class="post-tag" href="/?tag=${encodeURIComponent(tagSlug(tag))}">${escapeHtml(tag)}</a>`,
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
            ${tagLinks}
          </div>
          <h3 class="post-title"><a class="post-title-link" href="/post/${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></h3>
          ${excerpt}
        </div>
        <div class="post-aside">
          <span class="post-time"><i data-lucide="clock"></i>${minutes} min</span>
          <i class="post-arrow" data-lucide="arrow-up-right"></i>
        </div>
      </article>`;
    })
    .join("");

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

function setView(view: "default" | "graph"): void {
  const showGraph = view === "graph";

  viewButtons.forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  if (showGraph) {
    window.scrollTo({ top: 0, behavior: "auto" });
    updateGraphTop();
    document.body.classList.add("graph-mode");
    defaultView.hidden = true;
    graphView.hidden = false;
    updateCount(posts.length);
    if (!graph) {
      graph = createPostsGraph(graphCanvas, posts);
    }
    graph.start();
    return;
  }

  graph?.stop();
  document.body.classList.remove("graph-mode");
  graphView.hidden = true;
  defaultView.hidden = false;
  updateCount(filteredPosts.length);
}

updateGraphTop();
window.addEventListener("resize", updateGraphTop);
list.innerHTML = '<p class="empty-state">Carregando artigos…</p>';
tagFilter.hidden = true;

try {
  [posts, tags] = await Promise.all([api.getPosts(), api.getTags()]);
  filteredPosts = activeTag
    ? posts.filter((post) => post.tags.some((tag) => tagSlug(tag) === activeTag))
    : posts;
  updateCount(filteredPosts.length);
  renderTagFilter();
  renderPosts();
  viewButtons.forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view === "graph" ? "graph" : "default"));
  });
} catch {
  updateCount(0);
  list.innerHTML = '<p class="empty-state">Não foi possível carregar os artigos.</p>';
}
