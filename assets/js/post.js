(function () {
  const params = new URLSearchParams(window.location.search);
  const requestedSlug = params.get("slug");
  const posts = window.Pollo.getPosts();
  const post = requestedSlug ? window.Pollo.getPost(requestedSlug) : posts[0];
  const article = document.querySelector("#article");
  const commentsSection = document.querySelector("#comentarios");
  const progress = document.querySelector(".reading-progress");
  const escape = window.Pollo.escapeHTML;

  if (!post) {
    if (commentsSection) commentsSection.remove();
    if (progress) progress.remove();
    document.title = "Artigo não encontrado — pollo.city";
    article.innerHTML = `<div class="not-found">
      <p class="eyebrow">Erro 404</p>
      <h1 class="not-found-title">Esse artigo não existe.</h1>
      <p>O endereço pode ter mudado, ou o artigo nunca esteve aqui.</p>
      <a class="button" href="index.html#artigos">Voltar aos artigos <i data-lucide="arrow-left"></i></a>
    </div>`;
    window.PolloUI.refreshIcons();
    return;
  }

  const minutes = window.Pollo.readingMinutes(post.body);
  const metaHost = document.querySelector("#article-meta");
  const title = document.querySelector("#article-title");
  const deck = document.querySelector("#article-deck");
  const byline = document.querySelector("#article-byline");
  const body = document.querySelector("#article-body");

  document.title = `${post.title} — pollo.city`;
  document.querySelector('meta[name="description"]').setAttribute("content", post.excerpt);

  const tagLinks = post.tags.length
    ? `<span class="article-tags">${post.tags.map((tag) => `<a class="article-tag" href="index.html?tag=${encodeURIComponent(window.Pollo.tagSlug(tag))}">${escape(tag)}</a>`).join("")}</span>`
    : "";

  metaHost.innerHTML = `<time datetime="${escape(post.date)}">${window.Pollo.formatDate(post.date)}</time>${tagLinks}`;
  title.textContent = post.title;
  deck.textContent = post.excerpt;
  byline.innerHTML = `<span class="byline-author">Por Pollo</span>
    <span>São Paulo, BR</span>
    <span class="meta-icon"><i data-lucide="clock"></i>${minutes} min de leitura</span>`;
  body.innerHTML = window.PolloMarkdown.render(post.body);

  let comments = window.Pollo.getComments(post.slug);
  const commentCount = document.querySelector("[data-comment-count]");
  const commentsList = document.querySelector("#comments-list");
  const commentForm = document.querySelector("#comment-form");
  const nameField = document.querySelector("#comment-name");
  const bodyField = document.querySelector("#comment-body");
  const status = document.querySelector("#comment-status");

  function renderComments(highlightId) {
    commentCount.textContent = String(comments.length);
    commentsList.innerHTML = "";

    if (!comments.length) {
      const empty = document.createElement("p");
      empty.className = "comments-empty";
      empty.textContent = "Nenhum comentário ainda.";
      commentsList.appendChild(empty);
      return;
    }

    comments.forEach((comment) => {
      const item = document.createElement("article");
      item.className = "comment-item";
      item.dataset.commentId = comment.id;

      const avatar = document.createElement("span");
      avatar.className = "comment-avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = window.Pollo.initials(comment.name);

      const content = document.createElement("div");
      const head = document.createElement("div");
      head.className = "comment-head";

      const name = document.createElement("p");
      name.className = "comment-name";
      name.textContent = comment.name;

      const time = document.createElement("time");
      time.className = "comment-date";
      time.dateTime = comment.date;
      time.textContent = window.Pollo.formatCommentDate(comment.date);

      const text = document.createElement("p");
      text.className = "comment-text";
      text.textContent = comment.body;

      head.append(name, time);
      content.append(head, text);
      item.append(avatar, content);
      commentsList.appendChild(item);

      if (highlightId && comment.id === highlightId) {
        item.setAttribute("tabindex", "-1");
        item.focus({ preventScroll: true });
      }
    });
  }

  function setStatus(message, isError) {
    status.textContent = message;
    status.classList.toggle("is-error", Boolean(isError));
    status.hidden = false;
  }

  commentForm.addEventListener("submit", (event) => {
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

    try {
      const comment = window.Pollo.addComment(post.slug, { name, body: message });
      comments = window.Pollo.getComments(post.slug);
      commentForm.reset();
      renderComments(comment.id);
      setStatus("Comentário publicado.", false);
      window.setTimeout(() => {
        if (!status.classList.contains("is-error")) status.hidden = true;
      }, 5000);
    } catch (error) {
      setStatus("Não foi possível salvar o comentário neste navegador.", true);
    }
  });

  renderComments();
  window.PolloUI.refreshIcons();

  const progressBar = document.querySelector("[data-progress-bar]");
  let progressFrame = 0;

  function updateProgress() {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
    progressBar.style.transform = `scaleX(${progress})`;
    progressFrame = 0;
  }

  window.addEventListener("scroll", () => {
    if (progressFrame) return;
    progressFrame = window.requestAnimationFrame(updateProgress);
  }, { passive: true });

  window.addEventListener("resize", updateProgress);
  updateProgress();
})();
