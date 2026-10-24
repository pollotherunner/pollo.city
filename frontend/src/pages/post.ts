import { api } from "@/api/client";
import type { Comment, Post } from "@/api/types";
import { escapeHtml, query } from "@/lib/dom";
import { formatDate, formatDateTime } from "@/lib/dates";
import { refreshIcons } from "@/lib/icons";
import { enhanceContent, renderMarkdown } from "@/lib/markdown";
import { initials, readingMinutes } from "@/lib/strings";
import { tagSlug } from "@/lib/tags";
import { mountSiteChrome } from "@/ui/chrome";

mountSiteChrome();

const article = query<HTMLElement>("#article");
const commentsSection = query<HTMLElement>("#comentarios");
const progress = query<HTMLElement>(".reading-progress");
const progressBar = query<HTMLElement>("[data-progress-bar]");

function requestedSlug(): string | null {
  const pathMatch = window.location.pathname.match(/^\/post\/([^/]+)\/?$/);
  if (pathMatch?.[1]) {
    try {
      return decodeURIComponent(pathMatch[1]);
    } catch {
      return pathMatch[1];
    }
  }
  return new URLSearchParams(window.location.search).get("slug");
}

function renderNotFound(message: string): void {
  commentsSection.remove();
  progress.remove();
  document.title = "Artigo não encontrado — pollo.city";
  article.innerHTML = `<div class="not-found">
    <p class="eyebrow">Erro 404</p>
    <h1 class="not-found-title">Esse artigo não existe.</h1>
    <p>${escapeHtml(message)}</p>
    <a class="button" href="/#artigos">Voltar aos artigos <i data-lucide="arrow-left"></i></a>
  </div>`;
  refreshIcons(article);
}

function renderArticle(post: Post): void {
  const metaHost = query<HTMLElement>("#article-meta");
  const title = query<HTMLElement>("#article-title");
  const deck = query<HTMLElement>("#article-deck");
  const byline = query<HTMLElement>("#article-byline");
  const body = query<HTMLElement>("#article-body");
  const minutes = readingMinutes(post.body);

  document.title = `${post.title} — pollo.city`;
  document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute("content", post.excerpt || post.title);

  const tagLinks = post.tags.length
    ? `<span class="article-tags">${post.tags
        .map(
          (tag) =>
            `<a class="article-tag" href="/?tag=${encodeURIComponent(tagSlug(tag))}">${escapeHtml(tag)}</a>`,
        )
        .join("")}</span>`
    : "";

  metaHost.innerHTML = `<time datetime="${escapeHtml(post.date)}">${formatDate(post.date)}</time>${tagLinks}`;
  title.textContent = post.title;
  deck.textContent = post.excerpt;
  deck.hidden = !post.excerpt;
  byline.innerHTML = `<span class="byline-author">Por Pollo</span>
    <span>São Paulo, BR</span>
    <span class="meta-icon"><i data-lucide="clock"></i>${minutes} min de leitura</span>`;
  body.innerHTML = renderMarkdown(post.body);
  enhanceContent(body);
  refreshIcons(article);
}

function renderComments(comments: Comment[], highlightId?: number): void {
  const count = query<HTMLElement>("[data-comment-count]");
  const list = query<HTMLElement>("#comments-list");
  count.textContent = String(comments.length);
  list.innerHTML = "";

  if (!comments.length) {
    const empty = document.createElement("p");
    empty.className = "comments-empty";
    empty.textContent = "Nenhum comentário ainda.";
    list.appendChild(empty);
    return;
  }

  comments.forEach((comment) => {
    const item = document.createElement("article");
    item.className = "comment-item";
    item.dataset.commentId = String(comment.id);

    const avatar = document.createElement("span");
    avatar.className = "comment-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = initials(comment.name);

    const content = document.createElement("div");
    const head = document.createElement("div");
    head.className = "comment-head";

    const name = document.createElement("p");
    name.className = "comment-name";
    name.textContent = comment.name;

    const time = document.createElement("time");
    time.className = "comment-date";
    time.dateTime = comment.date;
    time.textContent = formatDateTime(comment.date);

    const text = document.createElement("p");
    text.className = "comment-text";
    text.textContent = comment.body;

    head.append(name, time);
    content.append(head, text);
    item.append(avatar, content);
    list.appendChild(item);

    if (highlightId === comment.id) {
      item.tabIndex = -1;
      item.focus({ preventScroll: true });
    }
  });
}

function mountComments(post: Post): void {
  const form = query<HTMLFormElement>("#comment-form");
  const nameField = query<HTMLInputElement>("#comment-name");
  const bodyField = query<HTMLTextAreaElement>("#comment-body");
  const status = query<HTMLElement>("#comment-status");
  const submitButton = query<HTMLButtonElement>('button[type="submit"]', form);

  const setStatus = (message: string, isError: boolean): void => {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
    status.hidden = false;
  };

  api
    .getComments(post.slug)
    .then((comments) => renderComments(comments))
    .catch(() => {
      query<HTMLElement>("#comments-list").innerHTML =
        '<p class="comments-empty">Não foi possível carregar os comentários.</p>';
    });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = nameField.value.trim();
    const message = bodyField.value.trim();

    nameField.removeAttribute("aria-invalid");
    bodyField.removeAttribute("aria-invalid");

    if (name.length < 2) {
      nameField.setAttribute("aria-invalid", "true");
      nameField.focus();
      setStatus("Escreva seu nome antes de comentar.", true);
      return;
    }

    if (message.length < 2) {
      bodyField.setAttribute("aria-invalid", "true");
      bodyField.focus();
      setStatus("Escreva uma mensagem antes de comentar.", true);
      return;
    }

    submitButton.disabled = true;
    try {
      const comment = await api.addComment(post.slug, { name, body: message });
      const comments = await api.getComments(post.slug);
      form.reset();
      renderComments(comments, comment.id);
      setStatus("Comentário publicado.", false);
      window.setTimeout(() => {
        if (!status.classList.contains("is-error")) {
          status.hidden = true;
        }
      }, 5000);
    } catch {
      setStatus("Não foi possível publicar o comentário.", true);
    } finally {
      submitButton.disabled = false;
    }
  });
}

function mountReadingProgress(): void {
  let frameId = 0;

  const update = (): void => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
    progressBar.style.transform = `scaleX(${ratio})`;
    frameId = 0;
  };

  window.addEventListener(
    "scroll",
    () => {
      if (frameId) {
        return;
      }
      frameId = window.requestAnimationFrame(update);
    },
    { passive: true },
  );
  window.addEventListener("resize", update);
  update();
}

async function bootstrap(): Promise<void> {
  const slug = requestedSlug();
  let posts: Post[];
  try {
    posts = await api.getPosts();
  } catch {
    renderNotFound("Não foi possível carregar o artigo agora.");
    return;
  }

  const post = slug ? posts.find((item) => item.slug === slug) : posts[0];
  if (!post) {
    renderNotFound("O endereço pode ter mudado, ou o artigo nunca esteve aqui.");
    return;
  }

  renderArticle(post);
  mountComments(post);
  mountReadingProgress();
}

void bootstrap();
