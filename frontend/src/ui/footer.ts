export function mountFooter(host: HTMLElement): void {
  host.innerHTML = `<footer class="site-footer">
    <div class="shell footer-inner">
      <span>© <span data-current-year>2026</span> pollo.city</span>
      <a href="#top">Voltar ao topo <i data-lucide="arrow-up"></i></a>
    </div>
  </footer>`;

  host.querySelectorAll<HTMLElement>("[data-current-year]").forEach((element) => {
    element.textContent = String(new Date().getFullYear());
  });
}
