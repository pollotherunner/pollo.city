import type Editor from "@toast-ui/editor";
import { api } from "@/api/client";
import { byId } from "@/lib/dom";
import { formatDateTime } from "@/lib/dates";
import { countWords, readingMinutes } from "@/lib/strings";
import { createMarkdownEditor } from "./markdown-editor";

interface AboutEditorCallbacks {
  onClose(): Promise<void> | void;
}

export class AboutEditor {
  private readonly root = byId<HTMLElement>("about-view");
  private readonly backButton = byId<HTMLButtonElement>("about-back");
  private readonly saveButton = byId<HTMLButtonElement>("save-about-button");
  private readonly saveState = byId<HTMLElement>("about-save-state");
  private readonly titleField = byId<HTMLInputElement>("about-title");
  private readonly ledeField = byId<HTMLTextAreaElement>("about-lede");
  private readonly editorHost = byId<HTMLElement>("about-editor");
  private readonly wordCount = byId<HTMLElement>("about-word-count");
  private readonly readTime = byId<HTMLElement>("about-read-time");

  private editor: Editor | null = null;
  private dirty = false;
  private syncing = false;

  constructor(private readonly callbacks: AboutEditorCallbacks) {}

  mount(): void {
    this.backButton.addEventListener("click", () => {
      void this.close();
    });
    this.saveButton.addEventListener("click", () => {
      void this.save();
    });
    this.titleField.addEventListener("input", () => this.markDirty());
    this.ledeField.addEventListener("input", () => this.markDirty());
    this.bindShortcuts();
  }

  isOpen(): boolean {
    return !this.root.hidden;
  }

  hasUnsavedChanges(): boolean {
    return this.isOpen() && this.dirty;
  }

  async open(): Promise<void> {
    const about = await api.getAbout(true);
    this.titleField.value = about.title;
    this.ledeField.value = about.lede;

    this.syncing = true;
    try {
      this.ensureEditor();
      this.editor?.setMarkdown(about.body, false);
      this.updateStats();
      window.setTimeout(() => {
        this.syncing = false;
        this.updateStats();
      }, 100);
    } catch {
      this.syncing = false;
      this.setSaveState("Não foi possível carregar o editor.", true);
    }

    this.dirty = false;
    if (this.editor) {
      this.setSaveState(about.updatedAt ? `Atualizado em ${formatDateTime(about.updatedAt)}` : "Conteúdo padrão");
    }
    window.requestAnimationFrame(() => this.titleField.focus({ preventScroll: true }));
  }

  private ensureEditor(): Editor {
    if (this.editor) {
      return this.editor;
    }
    this.editor = createMarkdownEditor({
      element: this.editorHost,
      minHeight: "460px",
      placeholder: "Escreva o conteúdo da página Sobre",
      onChange: () => {
        if (!this.syncing) {
          this.markDirty();
        }
      },
      onError: (message) => this.setSaveState(message, true),
    });
    return this.editor;
  }

  private markdown(): string {
    return this.editor?.getMarkdown().trim() ?? "";
  }

  private updateStats(): void {
    const markdown = this.markdown();
    const words = countWords(markdown);
    this.wordCount.textContent = `${words} ${words === 1 ? "palavra" : "palavras"}`;
    this.readTime.textContent = `${readingMinutes(markdown)} min de leitura`;
  }

  private markDirty(): void {
    this.dirty = true;
    this.updateStats();
    this.setSaveState("Alterações não salvas");
  }

  private setSaveState(message: string, isError = false): void {
    this.saveState.textContent = message;
    this.saveState.classList.toggle("is-error", isError);
  }

  private async save(): Promise<void> {
    const title = this.titleField.value.trim();
    if (!title) {
      this.setSaveState("Escreva um título.", true);
      this.titleField.focus();
      return;
    }

    this.saveButton.disabled = true;
    this.setSaveState("Salvando…");
    try {
      const about = await api.updateAbout({
        title,
        lede: this.ledeField.value.trim(),
        body: this.markdown(),
      });
      this.titleField.value = about.title;
      this.ledeField.value = about.lede;
      this.dirty = false;
      this.setSaveState("Sobre salvo");
    } catch {
      this.setSaveState("Não foi possível salvar a página Sobre.", true);
    } finally {
      this.saveButton.disabled = false;
    }
  }

  private async close(): Promise<void> {
    if (this.dirty && !window.confirm("Descartar as alterações da página Sobre?")) {
      return;
    }
    await this.callbacks.onClose();
  }

  private bindShortcuts(): void {
    document.addEventListener(
      "keydown",
      (event) => {
        if (!this.isOpen() || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        void this.save();
      },
      true,
    );
  }
}
