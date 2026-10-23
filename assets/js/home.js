(function () {
  const list = document.querySelector("#post-list");
  const posts = window.Pollo.getPosts();
  const escape = window.Pollo.escapeHTML;

  document.querySelectorAll("[data-post-count]").forEach((node) => {
    node.textContent = `${posts.length} ${posts.length === 1 ? "nota" : "notas"}`;
  });

  if (!posts.length) {
    list.innerHTML = '<p class="empty-state">Nenhuma nota por aqui ainda.</p>';
    return;
  }

  list.innerHTML = posts.map((post) => {
    const minutes = window.Pollo.readingMinutes(post.body);
    return `<a class="post-row" href="post.html?slug=${encodeURIComponent(post.slug)}">
      <div class="post-meta">
        <span class="post-category">${escape(post.category)}</span>
        <span class="meta-slash">/</span>
        <time datetime="${escape(post.date)}">${window.Pollo.formatDate(post.date)}</time>
      </div>
      <div class="post-copy">
        <h3 class="post-title">${escape(post.title)}</h3>
        <p class="post-excerpt">${escape(post.excerpt)}</p>
      </div>
      <div class="post-aside">
        <span class="post-time"><i data-lucide="clock"></i>${minutes} min</span>
        <i class="post-arrow" data-lucide="arrow-up-right"></i>
      </div>
    </a>`;
  }).join("");

  window.PolloUI.refreshIcons();
})();
