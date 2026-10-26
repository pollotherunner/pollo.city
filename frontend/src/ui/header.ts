import { refreshIcons } from "@/lib/icons";
import type { PageKind } from "./page";

function activeAttribute(current: boolean): string {
  return current ? ' aria-current="page"' : "";
}

function mountMobileNav(host: HTMLElement): void {
  const toggle = host.querySelector<HTMLButtonElement>(".nav-toggle");
  const nav = host.querySelector<HTMLElement>(".nav-links");
  if (!toggle || !nav) {
    return;
  }

  const setOpen = (open: boolean): void => {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    const label = open ? "Fechar menu" : "Abrir menu";
    toggle.setAttribute("aria-label", label);
    toggle.setAttribute("title", label);
    toggle.innerHTML = `<i data-lucide="${open ? "x" : "menu"}"></i>`;
    refreshIcons(toggle);
  };

  toggle.addEventListener("click", () => {
    setOpen(!nav.classList.contains("is-open"));
  });

  nav.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a")) {
      setOpen(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !nav.classList.contains("is-open") || document.querySelector("dialog[open]")) {
      return;
    }
    setOpen(false);
    toggle.focus();
  });

  document.addEventListener("click", (event) => {
    if (!nav.classList.contains("is-open")) {
      return;
    }
    if (event.target instanceof Node && !host.contains(event.target)) {
      setOpen(false);
    }
  });

  const mobileQuery = window.matchMedia("(max-width: 680px)");
  mobileQuery.addEventListener("change", () => {
    if (!mobileQuery.matches) {
      setOpen(false);
    }
  });
}

export function mountHeader(host: HTMLElement, page: PageKind): void {
  const articlesCurrent = page === "home" || page === "post";
  const offTopicCurrent = page === "off-topic";
  const archiveCurrent = page === "archive";
  const aboutCurrent = page === "about";

  host.innerHTML = `<header class="site-header">
    <div class="shell header-inner">
      <a class="brand" href="/" aria-label="pollo.city, página inicial">pollo.city</a>
      <button class="nav-toggle" type="button" aria-label="Abrir menu" title="Abrir menu" aria-expanded="false" aria-controls="site-nav"><i data-lucide="menu"></i></button>
      <nav class="nav-links" id="site-nav" aria-label="Principal">
        <div class="nav-menu">
          <a href="/"${activeAttribute(articlesCurrent)}>Artigos</a>
          <a href="/off-topic"${activeAttribute(offTopicCurrent)}>Off-Topic</a>
          <a href="/arquivo"${activeAttribute(archiveCurrent)}>Arquivo</a>
          <a href="/sobre"${activeAttribute(aboutCurrent)}>Sobre</a>
        </div>
        <div class="nav-actions">
          <button class="search-toggle" type="button" aria-label="Buscar artigos" title="Buscar artigos" aria-haspopup="dialog" aria-expanded="false" aria-controls="site-search-dialog"><i data-lucide="search"></i></button>
          <button class="theme-toggle" type="button" aria-label="Ativar modo escuro" title="Ativar modo escuro" aria-pressed="false"><i data-lucide="moon"></i></button>
        </div>
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

  mountMobileNav(host);
}
