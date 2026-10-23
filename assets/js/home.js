(function () {
  const list = document.querySelector("#post-list");
  const posts = window.Pollo.getPosts();
  const escape = window.Pollo.escapeHTML;

  document.querySelectorAll("[data-post-count]").forEach((node) => {
    node.textContent = `${posts.length} ${posts.length === 1 ? "artigo" : "artigos"}`;
  });

  if (!posts.length) {
    list.innerHTML = '<p class="empty-state">Nenhum artigo ainda.</p>';
    return;
  }

  list.innerHTML = posts.map((post) => {
    const minutes = window.Pollo.readingMinutes(post.body);
    const thumbnail = post.thumbnail || window.Pollo.defaultThumbnail;
    return `<a class="post-row" href="post.html?slug=${encodeURIComponent(post.slug)}">
      <div class="post-thumb">
        <img src="${escape(thumbnail)}" alt="" loading="lazy">
      </div>
      <div class="post-copy">
        <div class="post-meta">
          <span class="post-category">${escape(post.category)}</span>
          <time datetime="${escape(post.date)}">${window.Pollo.formatDate(post.date)}</time>
        </div>
        <h3 class="post-title">${escape(post.title)}</h3>
        <p class="post-excerpt">${escape(post.excerpt)}</p>
      </div>
      <div class="post-aside">
        <span class="post-time"><i data-lucide="clock"></i>${minutes} min</span>
        <i class="post-arrow" data-lucide="arrow-up-right"></i>
      </div>
    </a>`;
  }).join("");

  list.querySelectorAll(".post-thumb img").forEach((image) => {
    image.addEventListener("error", () => {
      image.src = window.Pollo.defaultThumbnail;
    }, { once: true });
  });

  window.PolloUI.refreshIcons();
})();
