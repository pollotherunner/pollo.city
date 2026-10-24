import { api } from "@/api/client";
import { query } from "@/lib/dom";
import { refreshIcons } from "@/lib/icons";
import { enhanceContent, renderMarkdown } from "@/lib/markdown";

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

interface MarkdownAction {
  name: string;
  label: string;
  icon: string;
  shortcut?: string;
}

const TOOLBAR: Array<MarkdownAction | "separator"> = [
  { name: "bold", label: "Negrito", icon: "bold", shortcut: "Ctrl+B" },
  { name: "italic", label: "Itálico", icon: "italic", shortcut: "Ctrl+I" },
  { name: "strike", label: "Riscado", icon: "strikethrough" },
  "separator",
  { name: "h2", label: "Título 2", icon: "heading-2" },
  { name: "h3", label: "Título 3", icon: "heading-3" },
  { name: "quote", label: "Citação", icon: "quote" },
  "separator",
  { name: "ul", label: "Lista", icon: "list" },
  { name: "ol", label: "Lista numerada", icon: "list-ordered" },
  { name: "task", label: "Lista de tarefas", icon: "list-checks" },
  "separator",
  { name: "code", label: "Código", icon: "code" },
  { name: "codeblock", label: "Bloco de código", icon: "square-code" },
  { name: "table", label: "Tabela", icon: "table" },
  "separator",
  { name: "link", label: "Link", icon: "link", shortcut: "Ctrl+K" },
  { name: "image", label: "Imagem", icon: "image" },
];

function toolbarMarkup(): string {
  return TOOLBAR.map((item) => {
    if (item === "separator") {
      return '<span class="md-editor-separator" aria-hidden="true"></span>';
    }
    const shortcut = item.shortcut ? ` (${item.shortcut})` : "";
    return `<button class="md-editor-button" type="button" data-md-action="${item.name}" title="${item.label}${shortcut}" aria-label="${item.label}"><i data-lucide="${item.icon}"></i></button>`;
  }).join("");
}

export function createMarkdownEditor(options: MarkdownEditorOptions): MarkdownEditor {
  const host = options.element;
  const ariaLabel = host.getAttribute("aria-label") ?? "Conteúdo";
  host.innerHTML = `
    <div class="md-editor" style="--md-editor-min-height: ${options.minHeight}">
      <div class="md-editor-toolbar" role="toolbar" aria-label="Formatação">
        <div class="md-editor-toolbar-group">${toolbarMarkup()}</div>
        <button class="md-editor-button md-editor-preview-button" type="button" data-md-action="preview" aria-pressed="false" title="Visualizar" aria-label="Visualizar"><i data-lucide="eye"></i><span>Visualizar</span></button>
      </div>
      <div class="md-editor-body">
        <textarea class="md-editor-input" spellcheck="true"></textarea>
        <div class="md-editor-preview prose" hidden></div>
      </div>
      <input class="md-editor-file" type="file" accept="image/*" hidden>
    </div>`;

  const root = query<HTMLElement>(".md-editor", host);
  const toolbar = query<HTMLElement>(".md-editor-toolbar", host);
  const textarea = query<HTMLTextAreaElement>(".md-editor-input", host);
  const preview = query<HTMLElement>(".md-editor-preview", host);
  const fileInput = query<HTMLInputElement>(".md-editor-file", host);
  const previewButton = query<HTMLButtonElement>('[data-md-action="preview"]', host);

  textarea.placeholder = options.placeholder;
  textarea.setAttribute("aria-label", ariaLabel);

  let syncing = false;
  let previewing = false;

  const autoGrow = (): void => {
    if (previewing) {
      return;
    }
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  const notifyChange = (): void => {
    autoGrow();
    if (previewing) {
      preview.innerHTML = renderMarkdown(textarea.value);
      enhanceContent(preview);
    }
    options.onChange();
  };

  const insertText = (text: string, selectionOffset = 0, selectionLength = 0): void => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.setRangeText(text, start, end, "end");
    const selectionStart = start + selectionOffset;
    textarea.setSelectionRange(selectionStart, selectionStart + selectionLength);
    textarea.focus();
    notifyChange();
  };

  const wrapSelection = (before: string, after: string, placeholder: string): void => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end) || placeholder;
    const replacement = `${before}${selected}${after}`;
    textarea.setRangeText(replacement, start, end, "end");
    const selectionStart = start + before.length;
    textarea.setSelectionRange(selectionStart, selectionStart + selected.length);
    textarea.focus();
    notifyChange();
  };

  const selectedBlock = (): { start: number; end: number; lines: string[] } => {
    const value = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const blockStart = value.lastIndexOf("\n", start - 1) + 1;
    const nextNewline = value.indexOf("\n", end);
    const blockEnd = nextNewline === -1 ? value.length : nextNewline;
    return {
      start: blockStart,
      end: blockEnd,
      lines: value.slice(blockStart, blockEnd).split("\n"),
    };
  };

  const replaceBlock = (block: { start: number; end: number }, lines: string[]): void => {
    textarea.setRangeText(lines.join("\n"), block.start, block.end, "end");
    textarea.setSelectionRange(block.start, block.start + lines.join("\n").length);
    textarea.focus();
    notifyChange();
  };

  const toggleLinePrefix = (prefix: string): void => {
    const block = selectedBlock();
    const allPrefixed = block.lines.every((line) => line.startsWith(prefix));
    replaceBlock(
      block,
      allPrefixed ? block.lines.map((line) => line.slice(prefix.length)) : block.lines.map((line) => `${prefix}${line}`),
    );
  };

  const toggleHeading = (level: number): void => {
    const prefix = `${"#".repeat(level)} `;
    const block = selectedBlock();
    const allAtLevel = block.lines.every((line) => line.startsWith(prefix));
    const stripped = block.lines.map((line) => line.replace(/^#{1,6}\s+/, ""));
    replaceBlock(block, allAtLevel ? stripped : stripped.map((line) => `${prefix}${line}`));
  };

  const toggleOrderedList = (): void => {
    const block = selectedBlock();
    const allOrdered = block.lines.every((line) => /^\d+\.\s+/.test(line));
    replaceBlock(
      block,
      allOrdered
        ? block.lines.map((line) => line.replace(/^\d+\.\s+/, ""))
        : block.lines.map((line, index) => `${index + 1}. ${line}`),
    );
  };

  const insertCodeBlock = (): void => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end);

    if (selected) {
      textarea.setRangeText(`\n\`\`\`\n${selected}\n\`\`\`\n`, start, end, "end");
      textarea.focus();
      notifyChange();
      return;
    }

    insertText("\n```\n\n```\n", 5, 0);
  };

  const insertTable = (): void => {
    insertText("\n| Coluna | Coluna |\n| --- | --- |\n| Texto | Texto |\n");
  };

  const insertLink = (): void => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end);
    const url = window.prompt("URL do link", "https://");
    if (!url) {
      textarea.focus();
      return;
    }
    const label = selected || "texto";
    textarea.setRangeText(`[${label}](${url})`, start, end, "end");
    textarea.focus();
    notifyChange();
  };

  const insertImage = (file: File | Blob): void => {
    const alt = file instanceof File ? file.name.replace(/\.[^.]+$/, "").replace(/[\[\]\n]/g, " ") : "imagem";

    api
      .uploadImage(file)
      .then((url) => {
        insertText(`![${alt}](${url})`);
      })
      .catch(() => {
        options.onError("Não foi possível carregar a imagem.");
      });
  };

  const setPreviewing = (value: boolean): void => {
    previewing = value;
    textarea.hidden = value;
    preview.hidden = !value;
    previewButton.setAttribute("aria-pressed", String(value));
    previewButton.setAttribute("aria-label", value ? "Editar" : "Visualizar");
    previewButton.setAttribute("title", value ? "Editar" : "Visualizar");
    previewButton.innerHTML = `<i data-lucide="${value ? "pencil" : "eye"}"></i><span>${value ? "Editar" : "Visualizar"}</span>`;
    refreshIcons(previewButton);

    if (value) {
      preview.innerHTML = renderMarkdown(textarea.value);
      enhanceContent(preview);
      return;
    }

    autoGrow();
    textarea.focus();
  };

  toolbar.addEventListener("mousedown", (event) => {
    if (event.target instanceof Element && event.target.closest("button")) {
      event.preventDefault();
    }
  });

  toolbar.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }
    const button = event.target.closest<HTMLButtonElement>("[data-md-action]");
    if (!button?.dataset.mdAction) {
      return;
    }

    const action = button.dataset.mdAction;
    switch (action) {
      case "bold":
        wrapSelection("**", "**", "texto");
        break;
      case "italic":
        wrapSelection("*", "*", "texto");
        break;
      case "strike":
        wrapSelection("~~", "~~", "texto");
        break;
      case "h2":
        toggleHeading(2);
        break;
      case "h3":
        toggleHeading(3);
        break;
      case "quote":
        toggleLinePrefix("> ");
        break;
      case "ul":
        toggleLinePrefix("- ");
        break;
      case "ol":
        toggleOrderedList();
        break;
      case "task":
        toggleLinePrefix("- [ ] ");
        break;
      case "code":
        wrapSelection("`", "`", "código");
        break;
      case "codeblock":
        insertCodeBlock();
        break;
      case "table":
        insertTable();
        break;
      case "link":
        insertLink();
        break;
      case "image":
        fileInput.click();
        break;
      case "preview":
        setPreviewing(!previewing);
        break;
    }
  });

  textarea.addEventListener("input", () => {
    if (syncing) {
      return;
    }
    notifyChange();
  });

  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Tab" && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      insertText("  ");
      return;
    }

    if (!(event.ctrlKey || event.metaKey)) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === "b") {
      event.preventDefault();
      wrapSelection("**", "**", "texto");
    } else if (key === "i") {
      event.preventDefault();
      wrapSelection("*", "*", "texto");
    } else if (key === "k") {
      event.preventDefault();
      insertLink();
    } else if (key === "p" && event.shiftKey) {
      event.preventDefault();
      setPreviewing(!previewing);
    }
  });

  textarea.addEventListener("paste", (event) => {
    const items = event.clipboardData?.items;
    if (!items) {
      return;
    }

    for (const item of items) {
      if (!item.type.startsWith("image/")) {
        continue;
      }
      const file = item.getAsFile();
      if (file) {
        event.preventDefault();
        insertImage(file);
        return;
      }
    }
  });

  textarea.addEventListener("dragover", (event) => {
    if (event.dataTransfer?.types.includes("Files")) {
      event.preventDefault();
    }
  });

  textarea.addEventListener("drop", (event) => {
    const file = event.dataTransfer?.files[0];
    if (file?.type.startsWith("image/")) {
      event.preventDefault();
      insertImage(file);
    }
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (file) {
      insertImage(file);
    }
  });

  autoGrow();
  refreshIcons(root);

  return {
    getMarkdown(): string {
      return textarea.value;
    },
    setMarkdown(value: string, cursorToEnd = false): void {
      syncing = true;
      textarea.value = value;
      syncing = false;
      const position = cursorToEnd ? value.length : 0;
      textarea.setSelectionRange(position, position);
      if (previewing) {
        preview.innerHTML = renderMarkdown(value);
        enhanceContent(preview);
      }
      autoGrow();
    },
    focus(): void {
      textarea.focus();
    },
  };
}
