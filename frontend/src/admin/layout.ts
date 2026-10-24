import { byId } from "@/lib/dom";

export class AdminLayout {
  private readonly authView = byId<HTMLElement>("auth-view");
  private readonly adminView = byId<HTMLElement>("admin-view");
  private readonly dashboardView = byId<HTMLElement>("dashboard-view");
  private readonly editorView = byId<HTMLElement>("editor-view");
  private readonly aboutView = byId<HTMLElement>("about-view");
  private readonly adminTitle = byId<HTMLElement>("admin-title");

  showLogin(): void {
    this.authView.hidden = false;
    this.adminView.hidden = true;
    this.adminView.classList.remove("is-editing");
    this.editorView.hidden = true;
    this.aboutView.hidden = true;
    document.title = "Admin — pollo.city";
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  showDashboard(): void {
    this.authView.hidden = true;
    this.adminView.hidden = false;
    this.adminView.classList.remove("is-editing");
    this.dashboardView.hidden = false;
    this.editorView.hidden = true;
    this.aboutView.hidden = true;
    document.title = "Artigos — pollo.city";
    this.adminTitle.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  showArticleEditor(): void {
    this.authView.hidden = true;
    this.adminView.hidden = false;
    this.adminView.classList.add("is-editing");
    this.dashboardView.hidden = true;
    this.editorView.hidden = false;
    this.aboutView.hidden = true;
    document.title = "Editor — pollo.city";
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  showAboutEditor(): void {
    this.authView.hidden = true;
    this.adminView.hidden = false;
    this.adminView.classList.add("is-editing");
    this.dashboardView.hidden = true;
    this.editorView.hidden = true;
    this.aboutView.hidden = false;
    document.title = "Sobre — Admin — pollo.city";
    window.scrollTo({ top: 0, behavior: "auto" });
  }
}
