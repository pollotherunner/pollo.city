import { api } from "@/api/client";
import type { Mark, Slice } from "prosemirror-model";
import { EditorState, TextSelection, type Transaction } from "prosemirror-state";
import { EditorView, type NodeViewConstructor } from "prosemirror-view";
import { openPrompt } from "./dialog";
import { parseMarkdown, serializeMarkdown, UnsupportedMarkdownError } from "./markdown";
import { createCodeBlockView, createTaskItemView } from "./nodeviews";
import { buildPlugins } from "./plugins";
import { editorSchema } from "./schema";
import { createToolbar, type EditorToolbar } from "./toolbar";

export interface MarkdownEditor {
  getMarkdown(): string;
  setMarkdown(value: string, cursorToEnd?: boolean): void;
  focus(): void;
}

interface MarkdownEditorOptions {
  element: HTMLElement;
  minHeight: string;
  placeholder: string;
  onChange(): void;
  onError(message: string): void;
}

const linkType = editorSchema.marks.link!;
const imageType = editorSchema.nodes.image!;
const paragraphType = editorSchema.nodes.paragraph!;

function sanitizeAlt(value: string): string {
  return value.replace(/\.[^.]+$/, "").replace(/[\[\]\n]/g, " ").trim() || "imagem";
}

function findLinkMark(state: EditorState): Mark | null {
  const { from, to, $from } = state.selection;
  if (from === to) {
    return linkType.isInSet(state.storedMarks ?? $from.marks()) ?? null;
  }

  let found: Mark | null = null;
  state.doc.nodesBetween(from, to, (node) => {
    for (const mark of node.marks) {
      if (mark.type === linkType) {
        found = mark;
      }
    }
  });
  return found;
}

function linkRangeAt(state: EditorState): { from: number; to: number; mark: Mark | null } {
  const { from, to, $from } = state.selection;
  if (from !== to) {
    return { from, to, mark: findLinkMark(state) };
  }

  const parent = $from.parent;
  let position = $from.start();
  let found: { from: number; to: number; mark: Mark } | null = null;

  parent.forEach((child) => {
    const start = position;
    const end = position + child.nodeSize;
    const mark = linkType.isInSet(child.marks);
    if (mark && $from.pos >= start && $from.pos <= end) {
      found = { from: start, to: end, mark };
    }
    position = end;
  });

  return found ?? { from, to, mark: null };
}

export function createMarkdownEditor(options: MarkdownEditorOptions): MarkdownEditor {
  const host = options.element;
  const ariaLabel = host.getAttribute("aria-label") ?? "Conteúdo";
  host.innerHTML = `
    <div class="pe-root">
      <div class="pe-rich">
        <div class="pe-toolbar-host"></div>
        <div class="pe-surface prose"></div>
      </div>
      <div class="pe-source-view" hidden>
        <div class="pe-source-notice">
          <span class="pe-source-message">Este conteúdo contém HTML ou markdown não suportado no editor visual. Edite no modo markdown para não perder a formatação.</span>
          <button class="pe-source-retry" type="button">Tentar editor visual</button>
        </div>
        <textarea class="pe-source" spellcheck="true" placeholder="Markdown"></textarea>
      </div>
      <input class="pe-file" type="file" accept="image/*" hidden>
    </div>`;

  const root = host.querySelector<HTMLElement>(".pe-root");
  const rich = host.querySelector<HTMLElement>(".pe-rich");
  const toolbarHost = host.querySelector<HTMLElement>(".pe-toolbar-host");
  const surface = host.querySelector<HTMLElement>(".pe-surface");
  const sourceView = host.querySelector<HTMLElement>(".pe-source-view");
  const source = host.querySelector<HTMLTextAreaElement>(".pe-source");
  const sourceMessage = host.querySelector<HTMLElement>(".pe-source-message");
  const sourceRetry = host.querySelector<HTMLButtonElement>(".pe-source-retry");
  const fileInput = host.querySelector<HTMLInputElement>(".pe-file");

  if (!root || !rich || !toolbarHost || !surface || !sourceView || !source || !sourceMessage || !sourceRetry || !fileInput) {
    throw new Error("Editor markup is incomplete");
  }

  root.style.setProperty("--pe-min-height", options.minHeight);

  let view: EditorView | null = null;
  let toolbar: EditorToolbar | null = null;
  let syncing = false;
  let sourceMode = false;

  const nodeViews: Record<string, NodeViewConstructor> = {
    task_item: createTaskItemView,
    code_block: createCodeBlockView,
  };

  const dispatchTransaction = (transaction: Transaction): void => {
    if (!view) {
      return;
    }
    const nextState = view.state.apply(transaction);
    view.updateState(nextState);
    toolbar?.update(nextState);
    if (transaction.docChanged && !syncing) {
      options.onChange();
    }
  };

  const insertImageAt = (url: string, alt: string, position?: number): void => {
    if (!view || sourceMode) {
      return;
    }

    const image = imageType.create({ src: url, alt, title: null });
    const pos = position ?? view.state.selection.from;
    const $pos = view.state.doc.resolve(Math.min(Math.max(pos, 1), view.state.doc.content.size));
    const target = $pos.parent.isTextblock
      ? view.state.tr.insert(pos, image)
      : view.state.tr.insert(pos, paragraphType.create(null, [image]));
    view.dispatch(target.scrollIntoView());
    view.focus();
  };

  const uploadImage = (file: File | Blob, position?: number): void => {
    const alt = file instanceof File ? sanitizeAlt(file.name) : "imagem";
    api
      .uploadImage(file)
      .then((url) => insertImageAt(url, alt, position))
      .catch(() => options.onError("Não foi possível carregar a imagem."));
  };

  const handleImagePaste = (_targetView: EditorView, event: ClipboardEvent): boolean => {
    const items = event.clipboardData?.items;
    if (!items) {
      return false;
    }
    for (const item of items) {
      if (!item.type.startsWith("image/")) {
        continue;
      }
      const file = item.getAsFile();
      if (!file) {
        continue;
      }
      event.preventDefault();
      uploadImage(file);
      return true;
    }
    return false;
  };

  const handleImageDrop = (targetView: EditorView, event: DragEvent, _slice: Slice, moved: boolean): boolean => {
    if (moved) {
      return false;
    }
    const file = event.dataTransfer?.files[0];
    if (!file?.type.startsWith("image/")) {
      return false;
    }
    event.preventDefault();
    const coordinates = targetView.posAtCoords({ left: event.clientX, top: event.clientY });
    uploadImage(file, coordinates?.pos);
    return true;
  };

  const dialogAnchor = (): { left: number; top: number } | undefined => {
    if (!view) {
      return undefined;
    }
    const rootRect = root.getBoundingClientRect();
    try {
      const coordinates = view.coordsAtPos(view.state.selection.from);
      return {
        left: coordinates.left - rootRect.left,
        top: coordinates.bottom - rootRect.top + 8,
      };
    } catch {
      return undefined;
    }
  };

  const openLinkDialog = (): void => {
    if (!view || sourceMode) {
      return;
    }

    const { from, to, mark: current } = linkRangeAt(view.state);
    const anchor = dialogAnchor();

    const promptOptions = {
      label: "URL do link",
      value: current?.attrs.href ?? "",
      placeholder: "https://",
      submitLabel: "Aplicar",
      ...(current ? { removeLabel: "Remover" } : {}),
      ...(anchor ? { anchor } : {}),
    };

    void openPrompt(root, promptOptions).then((result) => {
      if (!result || !view) {
        view?.focus();
        return;
      }

      if (result.remove) {
        view.dispatch(view.state.tr.removeMark(from, to, linkType));
        view.focus();
        return;
      }

      if (!result.value) {
        view.focus();
        return;
      }

      const mark = linkType.create({ href: result.value });
      if (from === to) {
        view.dispatch(view.state.tr.insertText(result.value, from, to).addMark(from, from + result.value.length, mark));
      } else {
        view.dispatch(view.state.tr.addMark(from, to, mark));
      }
      view.focus();
    });
  };

  const openImagePicker = (): void => {
    if (sourceMode) {
      return;
    }
    fileInput.click();
  };

  const openImageUrl = (): void => {
    if (!view || sourceMode) {
      return;
    }

    const anchor = dialogAnchor();
    const promptOptions = {
      label: "URL da imagem",
      placeholder: "https://",
      submitLabel: "Inserir",
      ...(anchor ? { anchor } : {}),
    };

    void openPrompt(root, promptOptions).then((result) => {
      if (!result?.value || !view) {
        view?.focus();
        return;
      }
      const filename = result.value.split(/[/?#]/).filter(Boolean).pop() ?? "imagem";
      insertImageAt(result.value, sanitizeAlt(filename));
      view.focus();
    });
  };

  toolbar = createToolbar({
    schema: editorSchema,
    getView: () => view,
    onLink: openLinkDialog,
    onImage: openImagePicker,
    onImageUrl: openImageUrl,
  });
  toolbarHost.append(toolbar.dom);

  const plugins = buildPlugins(editorSchema, {
    placeholder: options.placeholder,
    onLink: openLinkDialog,
  });

  view = new EditorView(surface, {
    state: EditorState.create({
      doc: parseMarkdown(""),
      plugins,
    }),
    dispatchTransaction,
    nodeViews,
    attributes: {
      "aria-label": ariaLabel,
      spellcheck: "true",
    },
    handlePaste: handleImagePaste,
    handleDrop: handleImageDrop,
  });

  toolbar.update(view.state);

  const setSelectionAtEnd = (end: boolean): void => {
    if (!view) {
      return;
    }
    const position = end ? view.state.doc.content.size : 0;
    const selection = TextSelection.near(view.state.doc.resolve(position));
    view.dispatch(view.state.tr.setSelection(selection));
  };

  const enterSourceMode = (markdown: string, error?: unknown): void => {
    sourceMode = true;
    syncing = true;
    source.value = markdown;
    syncing = false;
    rich.hidden = true;
    sourceView.hidden = false;
    sourceMessage.textContent =
      error instanceof UnsupportedMarkdownError
        ? "Este conteúdo contém HTML ou markdown não suportado no editor visual. Edite no modo markdown para não perder a formatação."
        : "Não foi possível abrir este conteúdo no editor visual. Edite no modo markdown.";
  };

  const tryVisualMode = (): void => {
    try {
      const doc = parseMarkdown(source.value);
      sourceMode = false;
      rich.hidden = false;
      sourceView.hidden = true;
      syncing = true;
      view?.updateState(EditorState.create({ doc, plugins }));
      syncing = false;
      if (view) {
        toolbar?.update(view.state);
        setSelectionAtEnd(false);
        view.focus();
      }
    } catch (error) {
      enterSourceMode(source.value, error);
    }
  };

  source.addEventListener("input", () => {
    if (!syncing) {
      options.onChange();
    }
  });

  sourceRetry.addEventListener("click", tryVisualMode);

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (file) {
      uploadImage(file);
    }
  });

  return {
    getMarkdown(): string {
      if (sourceMode) {
        return source.value;
      }
      return view ? serializeMarkdown(view.state.doc) : "";
    },

    setMarkdown(value: string, cursorToEnd = false): void {
      try {
        const doc = parseMarkdown(value);
        sourceMode = false;
        rich.hidden = false;
        sourceView.hidden = true;
        if (view) {
          syncing = true;
          view.updateState(EditorState.create({ doc, plugins }));
          syncing = false;
          toolbar?.update(view.state);
          setSelectionAtEnd(cursorToEnd);
        }
      } catch (error) {
        enterSourceMode(value, error);
      }
    },

    focus(): void {
      if (sourceMode) {
        source.focus();
        return;
      }
      view?.focus();
    },
  };
}
