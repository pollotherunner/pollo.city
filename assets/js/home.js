(function () {
  const list = document.querySelector("#post-list");
  const tagFilter = document.querySelector("#tag-filter");
  const count = document.querySelector("[data-post-count]");
  const defaultView = document.querySelector("#default-view");
  const graphView = document.querySelector("#graph-view");
  const graphCanvas = document.querySelector("#posts-graph");
  const viewButtons = [...document.querySelectorAll("[data-view]")];
  const siteHeader = document.querySelector(".site-header");
  const posts = window.Pollo.getPosts();
  const tags = window.Pollo.getTags();
  const params = new URLSearchParams(window.location.search);
  const activeTag = window.Pollo.tagSlug(params.get("tag") || "");
  const filteredPosts = activeTag
    ? posts.filter((post) => post.tags.some((tag) => window.Pollo.tagSlug(tag) === activeTag))
    : posts;
  const escape = window.Pollo.escapeHTML;
  let graph = null;

  function updateCount(total) {
    count.textContent = `${total} ${total === 1 ? "artigo" : "artigos"}`;
  }

  function updateGraphTop() {
    if (!siteHeader) return;
    document.documentElement.style.setProperty("--graph-top", `${siteHeader.offsetHeight}px`);
  }

  updateCount(filteredPosts.length);
  updateGraphTop();
  window.addEventListener("resize", updateGraphTop);

  tagFilter.hidden = !tags.length;
  tagFilter.innerHTML = [
    `<a class="tag-filter-link${activeTag ? "" : " is-active"}" href="index.html"${activeTag ? "" : ' aria-current="true"'}>Todas</a>`,
    ...tags.map((tag) => {
      const active = tag.slug === activeTag;
      return `<a class="tag-filter-link${active ? " is-active" : ""}" href="index.html?tag=${encodeURIComponent(tag.slug)}"${active ? ' aria-current="true"' : ""}>${escape(tag.name)}</a>`;
    }),
  ].join("");

  if (!filteredPosts.length) {
    list.innerHTML = `<p class="empty-state">${activeTag ? "Nenhum artigo com essa tag." : "Nenhum artigo ainda."}</p>`;
  } else {
    list.innerHTML = filteredPosts.map((post) => {
      const minutes = window.Pollo.readingMinutes(post.body);
      const thumbnail = post.thumbnail || window.Pollo.defaultThumbnail;
      const tagLinks = post.tags.length
        ? `<div class="post-tags">${post.tags.map((tag) => `<a class="post-tag" href="index.html?tag=${encodeURIComponent(window.Pollo.tagSlug(tag))}">${escape(tag)}</a>`).join("")}</div>`
        : "";

      return `<article class="post-row">
        <div class="post-thumb">
          <img src="${escape(thumbnail)}" alt="" loading="lazy">
        </div>
        <div class="post-copy">
          <div class="post-meta">
            <time datetime="${escape(post.date)}">${window.Pollo.formatDate(post.date)}</time>
            ${tagLinks}
          </div>
          <h3 class="post-title"><a class="post-title-link" href="post.html?slug=${encodeURIComponent(post.slug)}">${escape(post.title)}</a></h3>
          <p class="post-excerpt">${escape(post.excerpt)}</p>
        </div>
        <div class="post-aside">
          <span class="post-time"><i data-lucide="clock"></i>${minutes} min</span>
          <i class="post-arrow" data-lucide="arrow-up-right"></i>
        </div>
      </article>`;
    }).join("");
  }

  list.querySelectorAll(".post-thumb img").forEach((image) => {
    image.addEventListener("error", () => {
      image.src = window.Pollo.defaultThumbnail;
    }, { once: true });
  });

  function setView(view) {
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
      if (!graph) graph = window.PolloGraph.create(graphCanvas, posts);
      graph.start();
    } else {
      if (graph) graph.stop();
      document.body.classList.remove("graph-mode");
      graphView.hidden = true;
      defaultView.hidden = false;
      updateCount(filteredPosts.length);
    }
  }

  viewButtons.forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  window.PolloUI.refreshIcons();
})();
