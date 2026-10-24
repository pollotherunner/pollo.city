export function mountFooter(host: HTMLElement): void {
  host.innerHTML = `<footer class="site-footer">
    <div class="shell footer-inner">
      <span>© <span data-current-year>2026</span> pollo.city · Conteúdo sob <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="license noopener noreferrer">CC BY 4.0</a></span>
      <a href="#top">Voltar ao topo <i data-lucide="arrow-up"></i></a>
    </div>
  </footer>`;

  host.querySelectorAll<HTMLElement>("[data-current-year]").forEach((element) => {
    element.textContent = String(new Date().getFullYear());
  });
}
