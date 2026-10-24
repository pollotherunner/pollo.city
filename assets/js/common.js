(function () {
  const page = document.body.dataset.page || "home";
  const headerHost = document.querySelector("[data-site-header]");
  const footerHost = document.querySelector("[data-site-footer]");
  const blogCurrent = page === "home" || page === "post";
  const archiveCurrent = page === "archive";
  const sobreCurrent = page === "sobre";

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  const nav = `<nav class="nav-links" aria-label="Principal">
    <a href="/"${blogCurrent ? ' aria-current="page"' : ""}>Blog</a>
    <a href="/arquivo"${archiveCurrent ? ' aria-current="page"' : ""}>Arquivo</a>
    <a href="/sobre"${sobreCurrent ? ' aria-current="page"' : ""}>Sobre</a>
    <button class="search-toggle" type="button" aria-label="Buscar artigos" title="Buscar artigos" aria-haspopup="dialog" aria-expanded="false" aria-controls="site-search-dialog"><i data-lucide="search"></i></button>
  </nav>`;

  if (headerHost) {
    headerHost.innerHTML = `<header class="site-header">
      <div class="shell header-inner">
        <a class="brand" href="/" aria-label="pollo.city, página inicial">pollo.city</a>
        ${nav}
      </div>
    </header>
    <dialog class="search-dialog" id="site-search-dialog" aria-labelledby="search-title">
      <div class="search-panel">
        <div class="search-bar">
          <i data-lucide="search" aria-hidden="true"></i>
          <h2 class="sr-only" id="search-title">Buscar artigos</h2>
          <input class="search-input" id="site-search-input" type="search" placeholder="Buscar artigos" aria-label="Buscar artigos" autocomplete="off" spellcheck="false">
          <button class="search-close" type="button" data-close-search aria-label="Fechar busca"><i data-lucide="x"></i></button>
        </div>
        <div class="search-results" id="site-search-results"></div>
      </div>
    </dialog>`;
  }

  if (footerHost) {
    footerHost.innerHTML = `<footer class="site-footer">
      <div class="shell footer-inner">
        <span>© <span data-current-year>2026</span> pollo.city</span>
        <a href="#top">Voltar ao topo <i data-lucide="arrow-up"></i></a>
      </div>
    </footer>`;
  }

  const searchDialog = document.querySelector("#site-search-dialog");
  const searchInput = document.querySelector("#site-search-input");
  const searchResults = document.querySelector("#site-search-results");
  const searchToggle = document.querySelector(".search-toggle");
  const searchClose = document.querySelector("[data-close-search]");
  let searchPosts = [];

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function renderSearch(query) {
    const term = normalize(query).trim();
    const matches = searchPosts.filter((post) => {
      if (!term) return true;
      return normalize(`${post.title} ${post.tags.join(" ")} ${post.excerpt} ${post.body}`).includes(term);
    });

    if (!matches.length) {
      searchResults.innerHTML = '<p class="search-empty">Nenhum artigo encontrado.</p>';
      return;
    }

    searchResults.innerHTML = matches.map((post) => `<a class="search-result" href="/post/${encodeURIComponent(post.slug)}">
      <span class="search-result-copy">
        <span class="search-result-title">${window.Pollo.escapeHTML(post.title)}</span>
        <span class="search-result-meta">${post.tags.slice(0, 3).map((tag) => `<span>${window.Pollo.escapeHTML(tag)}</span>`).join("")}<time datetime="${window.Pollo.escapeHTML(post.date)}">${window.Pollo.formatDate(post.date)}</time></span>
      </span>
      <i data-lucide="arrow-up-right" aria-hidden="true"></i>
    </a>`).join("");
    window.PolloUI.refreshIcons();
  }

  async function openSearch() {
    searchInput.value = "";
    searchResults.innerHTML = '<p class="search-empty">Carregando artigos…</p>';
    searchToggle.setAttribute("aria-expanded", "true");
    searchDialog.showModal();
    window.requestAnimationFrame(() => searchInput.focus());

    try {
      searchPosts = await window.Pollo.getPosts();
      renderSearch(searchInput.value);
    } catch (error) {
      searchResults.innerHTML = '<p class="search-empty">Não foi possível carregar a busca.</p>';
    }
  }

  if (searchDialog && searchInput && searchResults && searchToggle) {
    searchToggle.addEventListener("click", openSearch);

    searchInput.addEventListener("input", () => {
      if (!searchPosts.length) return;
      renderSearch(searchInput.value);
    });

    searchInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      const firstResult = searchResults.querySelector(".search-result");
      if (!firstResult) return;
      event.preventDefault();
      window.location.href = firstResult.getAttribute("href");
    });

    searchDialog.addEventListener("click", (event) => {
      if (event.target === searchDialog) searchDialog.close();
      if (event.target.closest(".search-result")) searchDialog.close();
    });

    searchDialog.addEventListener("close", () => {
      searchToggle.setAttribute("aria-expanded", "false");
    });

    searchClose.addEventListener("click", () => searchDialog.close());
  }

  document.querySelectorAll("[data-current-year]").forEach((node) => {
    node.textContent = new Date().getFullYear();
  });

  refreshIcons();

  window.PolloUI = {
    refreshIcons,
  };
})();
