import type { PageKind } from "./page";

function activeAttribute(current: boolean): string {
  return current ? ' aria-current="page"' : "";
}

export function mountHeader(host: HTMLElement, page: PageKind): void {
  const articlesCurrent = page === "home" || page === "post";
  const offTopicCurrent = page === "off-topic";
  const archiveCurrent = page === "archive";
  const aboutCurrent = page === "about";

  host.innerHTML = `<header class="site-header">
    <div class="shell header-inner">
      <a class="brand" href="/" aria-label="pollo.city, página inicial">pollo.city</a>
      <nav class="nav-links" aria-label="Principal">
        <a href="/"${activeAttribute(articlesCurrent)}>Artigos</a>
        <a href="/off-topic"${activeAttribute(offTopicCurrent)}>Off-Topic</a>
        <a href="/arquivo"${activeAttribute(archiveCurrent)}>Arquivo</a>
        <a href="/sobre"${activeAttribute(aboutCurrent)}>Sobre</a>
        <button class="search-toggle" type="button" aria-label="Buscar artigos" title="Buscar artigos" aria-haspopup="dialog" aria-expanded="false" aria-controls="site-search-dialog"><i data-lucide="search"></i></button>
        <button class="theme-toggle" type="button" aria-label="Ativar modo escuro" title="Ativar modo escuro" aria-pressed="false"><i data-lucide="moon"></i></button>
      </nav>
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
