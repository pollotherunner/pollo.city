(function () {
  const page = document.body.dataset.page || "home";
  const headerHost = document.querySelector("[data-site-header]");
  const footerHost = document.querySelector("[data-site-footer]");
  const isHome = page === "home";
  const blogCurrent = page === "home" || page === "post";
  const sobreCurrent = page === "sobre";
  const adminCurrent = page === "admin";

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  const nav = `<nav class="nav-links" aria-label="Principal">
    <a href="index.html"${blogCurrent ? ' aria-current="page"' : ""}>Blog</a>
    <a href="sobre.html"${sobreCurrent ? ' aria-current="page"' : ""}>Sobre</a>
    <a href="admin.html"${adminCurrent ? ' aria-current="page"' : ""}><i data-lucide="key-round"></i>Admin</a>
  </nav>`;

  if (headerHost) {
    headerHost.innerHTML = isHome
      ? `<header class="site-header site-header--home">
          <div class="shell">
            <div class="home-nav">${nav}</div>
            <h1 class="home-brand"><a href="index.html">pollo.city</a></h1>
          </div>
        </header>`
      : `<header class="site-header">
          <div class="shell header-inner">
            <a class="brand" href="index.html" aria-label="pollo.city, página inicial">pollo.city</a>
            ${nav}
          </div>
        </header>`;
  }

  if (footerHost) {
    footerHost.innerHTML = `<footer class="site-footer">
      <div class="shell footer-inner">
        <span>© <span data-current-year>2026</span> pollo.city</span>
        <a href="#top">Voltar ao topo <i data-lucide="arrow-up"></i></a>
      </div>
    </footer>`;
  }

  document.querySelectorAll("[data-current-year]").forEach((node) => {
    node.textContent = new Date().getFullYear();
  });

  refreshIcons();

  window.PolloUI = {
    refreshIcons,
  };
})();
