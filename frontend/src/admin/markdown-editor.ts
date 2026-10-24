import Editor from "@toast-ui/editor";
import codeSyntaxHighlight from "@toast-ui/editor-plugin-code-syntax-highlight";
import "@toast-ui/editor/dist/i18n/pt-br";
import Prism from "prismjs";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-css";
import "prismjs/components/prism-go";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-python";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-typescript";
import { api } from "@/api/client";

interface MarkdownEditorOptions {
  element: HTMLElement;
  minHeight: string;
  placeholder: string;
  onChange(): void;
  onError(message: string): void;
}

const prism = Prism as typeof Prism & { manual: boolean };
prism.manual = true;

export function createMarkdownEditor(options: MarkdownEditorOptions): Editor {
  return new Editor({
    el: options.element,
    height: "auto",
    minHeight: options.minHeight,
    initialEditType: "wysiwyg",
    previewStyle: "tab",
    hideModeSwitch: true,
    usageStatistics: false,
    autofocus: false,
    language: "pt-BR",
    placeholder: options.placeholder,
    toolbarItems: [
      ["heading", "bold", "italic", "strike"],
      ["hr", "quote"],
      ["ul", "ol", "task", "indent", "outdent"],
      ["table", "image", "link"],
      ["code", "codeblock"],
    ],
    plugins: [[codeSyntaxHighlight, { highlighter: prism }]],
    hooks: {
      addImageBlobHook: async (blob, callback) => {
        try {
          const url = await api.uploadImage(blob);
          callback(url, blob instanceof File ? blob.name : "imagem");
          options.onChange();
        } catch {
          options.onError("Não foi possível carregar a imagem.");
        }
      },
    },
    events: {
      change: options.onChange,
    },
  });
}
