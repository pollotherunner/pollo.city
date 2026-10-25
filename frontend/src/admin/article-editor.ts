import { api } from "@/api/client";
import type { Draft, Post, PostInput } from "@/api/types";
import { byId } from "@/lib/dom";
import { countWords, readingMinutes } from "@/lib/strings";
import { createMarkdownEditor, type MarkdownEditor } from "./markdown-editor";
import { AudioField } from "./audio-field";
import { CoverField } from "./cover-field";
import { toDraftInput } from "./editor-payload";
import { TagEditor } from "./tag-editor";

export type ArticleSource =
  | { kind: "post"; post: Post }
  | { kind: "draft"; draft: Draft };

interface ArticleEditorCallbacks {
  onClose(): Promise<void> | void;
  onPublished(post: Post): Promise<void> | void;
}

export class ArticleEditor {
  private readonly root = byId<HTMLElement>("editor-view");
  private readonly backButton = byId<HTMLButtonElement>("editor-back");
  private readonly saveButton = byId<HTMLButtonElement>("save-draft-button");
  private readonly publishButton = byId<HTMLButtonElement>("publish-button");
  private readonly saveState = byId<HTMLElement>("editor-save-state");
  private readonly titleField = byId<HTMLInputElement>("editor-title");
  private readonly excerptField = byId<HTMLTextAreaElement>("editor-excerpt");
  private readonly sectionField = byId<HTMLSelectElement>("editor-section");
  private readonly wordCount = byId<HTMLElement>("editor-word-count");
  private readonly readTime = byId<HTMLElement>("editor-read-time");
  private readonly editorHost = byId<HTMLElement>("markdown-editor");
  private readonly tagEditor = new TagEditor(
    {
      chips: byId<HTMLElement>("editor-tag-chips"),
      input: byId<HTMLInputElement>("tag-input"),
      suggestions: byId<HTMLElement>("tag-suggestions"),
    },
    () => this.markChanged(),
  );
  private readonly coverField = new CoverField(
    {
      preview: byId<HTMLImageElement>("cover-preview"),
      button: byId<HTMLButtonElement>("cover-button"),
      input: byId<HTMLInputElement>("cover-input"),
      label: byId<HTMLElement>("cover-button-label"),
    },
    {
      onChange: () => this.markChanged(),
      onError: (message) => this.setSaveState(message, true),
    },
  );
  private readonly audioField = new AudioField(
    {
      preview: byId<HTMLAudioElement>("audio-preview"),
      button: byId<HTMLButtonElement>("audio-upload-button"),
      input: byId<HTMLInputElement>("audio-file-input"),
      removeButton: byId<HTMLButtonElement>("audio-remove-button"),
      label: byId<HTMLElement>("audio-upload-label"),
      status: byId<HTMLElement>("audio-status"),
    },
    {
      onChange: () => this.markChanged(),
      onError: (message) => this.setSaveState(message, true),
    },
  );

  private editor: MarkdownEditor | null = null;
  private draftId: string | null = null;
  private postSlug: string | null = null;
  private dirty = false;
  private revision = 0;
  private autosaveTimer: number | null = null;
  private saveChain: Promise<void> = Promise.resolve();
  private publishing = false;
  private syncingEditor = false;

  constructor(private readonly callbacks: ArticleEditorCallbacks) {}

  mount(): void {
    this.backButton.addEventListener("click", () => {
      void this.close();
    });
    this.saveButton.addEventListener("click", () => {
      void this.saveDraft();
    });
    this.publishButton.addEventListener("click", () => {
      void this.publish();
    });
    this.titleField.addEventListener("input", () => this.markChanged());
    this.excerptField.addEventListener("input", () => this.markChanged());
    this.sectionField.addEventListener("change", () => this.markChanged());
    this.tagEditor.mount();
    this.coverField.mount();
    this.audioField.mount();
    this.bindShortcuts();
  }

  isOpen(): boolean {
    return !this.root.hidden;
  }

  hasUnsavedChanges(): boolean {
    return this.isOpen() && this.dirty;
  }

  async open(source: ArticleSource | null): Promise<void> {
    this.clearAutosave();
    this.draftId = source?.kind === "draft" ? source.draft.id : null;
    this.postSlug = source?.kind === "draft" ? (source.draft.postSlug ?? null) : source?.post.slug ?? null;
    this.dirty = false;
    this.revision = 0;
    this.publishing = false;
    this.publishButton.disabled = false;
    this.saveChain = Promise.resolve();

    const post = source?.kind === "post" ? source.post : null;
    const draft = source?.kind === "draft" ? source.draft : null;
    const content = draft ?? post;

    this.titleField.value = content?.title ?? "";
    this.excerptField.value = content?.excerpt ?? "";
    this.sectionField.value = content?.section ?? "article";
    this.coverField.setValue(content?.thumbnail ?? "");
    this.audioField.setValue(content?.audio ?? "");

    try {
      this.tagEditor.setAvailable(await api.getTags());
    } catch {
      this.tagEditor.setAvailable([]);
    }
    this.tagEditor.setTags(content?.tags ?? []);

    this.syncingEditor = true;
    try {
      this.ensureEditor();
      this.editor?.setMarkdown(content?.body ?? "", false);
      this.updateStats();
      window.setTimeout(() => {
        this.syncingEditor = false;
        this.updateStats();
      }, 100);
    } catch {
      this.syncingEditor = false;
      this.setSaveState("Não foi possível carregar o editor.", true);
    }

    if (this.editor) {
      this.setSaveState(draft ? "Rascunho carregado" : "");
    }
    window.requestAnimationFrame(() => this.titleField.focus({ preventScroll: true }));
  }

  private ensureEditor(): MarkdownEditor {
    if (this.editor) {
      return this.editor;
    }
    this.editor = createMarkdownEditor({
      element: this.editorHost,
      minHeight: "560px",
      placeholder: "Escreva seu artigo",
      onChange: () => {
        if (!this.syncingEditor) {
          this.markChanged();
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

  private setSaveState(message: string, isError = false): void {
    this.saveState.textContent = message;
    this.saveState.classList.toggle("is-error", isError);
  }

  private markChanged(): void {
    this.dirty = true;
    this.revision += 1;
    this.updateStats();
    this.setSaveState("Alterações não salvas");
    this.clearAutosave();
    this.autosaveTimer = window.setTimeout(() => {
      this.autosaveTimer = null;
      void this.persistDraft(false);
    }, 900);
  }

  private clearAutosave(): void {
    if (this.autosaveTimer !== null) {
      window.clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
  }

  private collect(): PostInput {
    return {
      title: this.titleField.value.trim(),
      excerpt: this.excerptField.value.trim(),
      tags: this.tagEditor.getTags(),
      thumbnail: this.coverField.getValue(),
      body: this.markdown(),
      section: this.sectionField.value === "off-topic" ? "off-topic" : "article",
      audio: this.audioField.getValue(),
    };
  }

  private hasContent(data: PostInput): boolean {
    return Boolean(data.title || data.excerpt || data.body || data.thumbnail || data.audio);
  }

  private async persistDraft(announce: boolean): Promise<void> {
    this.clearAutosave();
    const data = this.collect();
    const revision = this.revision;

    if (!this.hasContent(data)) {
      this.saveChain = this.saveChain
        .then(async () => {
          if (!this.draftId) {
            return;
          }
          const draftId = this.draftId;
          this.draftId = null;
          await api.deleteDraft(draftId);
        })
        .catch(() => undefined);
      await this.saveChain;
      if (this.revision === revision) {
        this.dirty = false;
      }
      if (announce) {
        this.setSaveState("Escreva algo primeiro.", true);
      }
      return;
    }

    this.saveChain = this.saveChain
      .then(async () => {
        const payload = toDraftInput(data, this.postSlug);
        const draft = this.draftId
          ? await api.updateDraft(this.draftId, payload)
          : await api.createDraft(payload);
        this.draftId = draft.id;
        if (this.revision === revision) {
          this.dirty = false;
          this.setSaveState("Rascunho salvo");
        }
      })
      .catch(() => {
        this.setSaveState("Não foi possível salvar o rascunho.", true);
      });

    await this.saveChain;
  }

  private async saveDraft(): Promise<void> {
    await this.persistDraft(true);
  }

  private async close(): Promise<void> {
    this.clearAutosave();
    if (this.dirty || this.draftId) {
      await this.persistDraft(false);
    }
    await this.callbacks.onClose();
  }

  private async publish(): Promise<void> {
    if (this.publishing) {
      return;
    }
    if (this.audioField.isUploading()) {
      this.setSaveState("Aguarde o envio do áudio terminar.", true);
      return;
    }

    this.clearAutosave();
    this.publishing = true;
    this.publishButton.disabled = true;

    try {
      await this.saveChain;
      const data = this.collect();

      if (!data.title) {
        this.setSaveState("Escreva um título.", true);
        this.titleField.focus();
        return;
      }
      if (!data.body) {
        this.setSaveState("Escreva o conteúdo do artigo.", true);
        this.editor?.focus();
        return;
      }

      const post = this.postSlug
        ? await api.updatePost(this.postSlug, data)
        : await api.createPost(data);

      if (this.draftId) {
        const draftId = this.draftId;
        this.draftId = null;
        try {
          await api.deleteDraft(draftId);
        } catch {
          // Publishing succeeds even if draft cleanup fails.
        }
      }

      this.postSlug = post.slug;
      this.dirty = false;
      await this.callbacks.onPublished(post);
    } catch {
      this.setSaveState("Não foi possível publicar o artigo.", true);
    } finally {
      this.publishing = false;
      this.publishButton.disabled = false;
    }
  }

  private bindShortcuts(): void {
    document.addEventListener(
      "keydown",
      (event) => {
        if (!this.isOpen() || !(event.ctrlKey || event.metaKey)) {
          return;
        }
        if (event.key.toLowerCase() === "s") {
          event.preventDefault();
          event.stopPropagation();
          void this.saveDraft();
        }
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          void this.publish();
        }
      },
      true,
    );
  }
}
