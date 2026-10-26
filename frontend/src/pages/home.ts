import { api } from "@/api/client";
import type { Post, Tag } from "@/api/types";
import { createPostsGraph, type PostsGraph } from "@/graph/posts-graph";
import { mountIntro } from "@/intro/intro";
import { DEFAULT_THUMBNAIL } from "@/lib/constants";
import { query } from "@/lib/dom";
import { refreshIcons } from "@/lib/icons";
import { buildTags, renderPostRow, renderTagFilter } from "@/lib/post-list";
import { tagSlug } from "@/lib/tags";
import { mountSiteChrome } from "@/ui/chrome";

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
let articles: Post[] = [];
let tags: Tag[] = [];
let filteredPosts: Post[] = [];
let graph: PostsGraph | null = null;

function updateCount(total: number, noun: "artigo" | "publicação" = "artigo"): void {
  const plural = noun === "artigo" ? "artigos" : "publicações";
  count.textContent = `${total} ${total === 1 ? noun : plural}`;
}

function updateGraphTop(): void {
  document.documentElement.style.setProperty("--graph-top", `${siteHeader.offsetHeight}px`);
}

function renderPosts(): void {
  if (!filteredPosts.length) {
    list.innerHTML = `<p class="empty-state">${activeTag ? "Nenhum artigo com essa tag." : "Nenhum artigo ainda."}</p>`;
    return;
  }

  list.innerHTML = filteredPosts.map((post) => renderPostRow(post, "/")).join("");

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
    updateCount(posts.length, "publicação");
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
if (typeof ResizeObserver === "function") {
  new ResizeObserver(updateGraphTop).observe(siteHeader);
}
list.innerHTML = '<p class="empty-state">Carregando artigos…</p>';
tagFilter.hidden = true;

try {
  posts = await api.getPosts();
  articles = posts.filter((post) => post.section !== "off-topic");
  tags = buildTags(articles);
  filteredPosts = activeTag
    ? articles.filter((post) => post.tags.some((tag) => tagSlug(tag) === activeTag))
    : articles;
  updateCount(filteredPosts.length);
  tagFilter.hidden = tags.length === 0;
  tagFilter.innerHTML = renderTagFilter(tags, activeTag, "/");
  renderPosts();
  viewButtons.forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view === "graph" ? "graph" : "default"));
  });
} catch {
  updateCount(0);
  list.innerHTML = '<p class="empty-state">Não foi possível carregar os artigos.</p>';
}
