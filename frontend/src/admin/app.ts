import { api } from "@/api/client";
import type { Draft, Post } from "@/api/types";
import { refreshIcons } from "@/lib/icons";
import { AboutEditor } from "./about-editor";
import { ArticleEditor, type ArticleSource } from "./article-editor";
import { AuthView } from "./auth";
import { BackupController } from "./backup";
import { Dashboard } from "./dashboard";
import { AdminFeedback } from "./feedback";
import { AdminLayout } from "./layout";

export class AdminApp {
  private readonly layout = new AdminLayout();
  private readonly feedback = new AdminFeedback();
  private readonly articleEditor = new ArticleEditor({
    onClose: () => this.showDashboard(),
    onPublished: (post) => this.handlePublished(post),
  });
  private readonly aboutEditor = new AboutEditor({
    onClose: () => this.showDashboard(),
  });
  private readonly dashboard = new Dashboard({
    onNewArticle: () => {
      void this.openNewArticle();
    },
    onEditPost: (slug) => this.openPost(slug),
    onContinueDraft: (draft) => this.openDraft(draft),
    onEditAbout: () => {
      void this.openAbout();
    },
    onError: (message) => this.feedback.show(message, undefined, true),
  });
  private readonly backup = new BackupController({
    onError: (message) => this.feedback.show(message, undefined, true),
  });
  private readonly auth = new AuthView({
    onAuthenticated: () => this.showDashboard(),
    onLogout: () => this.showLogin(),
  });

  async start(): Promise<void> {
    this.articleEditor.mount();
    this.aboutEditor.mount();
    this.dashboard.mount();
    this.backup.mount();
    this.auth.mount();
    this.bindBeforeUnload();
    refreshIcons();

    if (await this.auth.restoreSession()) {
      await this.showDashboard();
      return;
    }
    this.showLogin();
  }

  private showLogin(): void {
    this.feedback.hide();
    this.layout.showLogin();
    this.auth.clearPassword();
    refreshIcons();
  }

  private async showDashboard(): Promise<void> {
    this.feedback.hide();
    this.layout.showDashboard();
    await this.dashboard.refresh();
  }

  private async openNewArticle(): Promise<void> {
    this.layout.showArticleEditor();
    await this.articleEditor.open(null);
  }

  private async openDraft(draft: Draft): Promise<void> {
    this.layout.showArticleEditor();
    await this.articleEditor.open({ kind: "draft", draft });
  }

  private async openPost(slug: string): Promise<void> {
    try {
      const draft = await api.getDraftForPost(slug);
      if (draft) {
        await this.openDraft(draft);
        return;
      }
      const post = await api.getPost(slug);
      if (!post) {
        this.feedback.show("Não foi possível abrir o artigo.", undefined, true);
        return;
      }
      const source: ArticleSource = { kind: "post", post };
      this.layout.showArticleEditor();
      await this.articleEditor.open(source);
    } catch {
      this.feedback.show("Não foi possível abrir o artigo.", undefined, true);
    }
  }

  private async openAbout(): Promise<void> {
    try {
      this.layout.showAboutEditor();
      await this.aboutEditor.open();
    } catch {
      await this.showDashboard();
      this.feedback.show("Não foi possível abrir a página Sobre.", undefined, true);
    }
  }

  private async handlePublished(post: Post): Promise<void> {
    await this.showDashboard();
    this.feedback.show("Artigo publicado.", { slug: post.slug });
  }

  private bindBeforeUnload(): void {
    window.addEventListener("beforeunload", (event) => {
      if (!this.articleEditor.hasUnsavedChanges() && !this.aboutEditor.hasUnsavedChanges()) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    });
  }
}
