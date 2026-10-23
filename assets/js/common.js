(function () {
  const page = document.body.dataset.page || "home";
  const headerHost = document.querySelector("[data-site-header]");
  const footerHost = document.querySelector("[data-site-footer]");
  const isHome = page === "home";

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  if (headerHost) {
    headerHost.innerHTML = isHome
      ? `<header class="home-header">
          <div class="shell">
            <div class="home-topline">
              <span>Um caderno de notas</span>
              <a href="admin.html"><i data-lucide="key-round"></i>Admin</a>
            </div>
            <h1 class="home-title"><a href="index.html">pollo.city</a></h1>
            <div class="home-subline">
              <p>Design, código e coisas miúdas. Sem pressa.</p>
              <span data-current-date>23 OUT 2026</span>
            </div>
          </div>
        </header>`
      : `<header class="site-header">
          <div class="shell header-inner">
            <a class="brand" href="index.html" aria-label="pollo.city, página inicial">pollo.city</a>
            <nav class="nav-links" aria-label="Principal">
              <a href="index.html#diario">Diário</a>
              <a href="admin.html"><i data-lucide="key-round"></i>Admin</a>
            </nav>
          </div>
        </header>`;
  }

  if (footerHost) {
    footerHost.innerHTML = `<footer class="site-footer">
      <div class="shell footer-inner">
        <span>© <span data-current-year>2026</span> pollo.city</span>
        <span>Feito com HTML e café</span>
        <a href="#top">Voltar ao topo <i data-lucide="arrow-up"></i></a>
      </div>
    </footer>`;
  }

  document.querySelectorAll("[data-current-date]").forEach((node) => {
    node.textContent = window.Pollo.formatDate(new Date());
  });

  document.querySelectorAll("[data-current-year]").forEach((node) => {
    node.textContent = new Date().getFullYear();
  });

  refreshIcons();

  window.PolloUI = {
    refreshIcons,
  };
})();
