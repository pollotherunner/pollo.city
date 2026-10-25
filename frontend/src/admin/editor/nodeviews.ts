import type { Node as PMNode } from "prosemirror-model";
import { TextSelection } from "prosemirror-state";
import type { EditorView, NodeView, NodeViewConstructor } from "prosemirror-view";

export const CODE_LANGUAGES = [
  { value: "", label: "Texto" },
  { value: "bash", label: "Bash" },
  { value: "css", label: "CSS" },
  { value: "go", label: "Go" },
  { value: "javascript", label: "JavaScript" },
  { value: "json", label: "JSON" },
  { value: "markdown", label: "Markdown" },
  { value: "plaintext", label: "Plain text" },
  { value: "python", label: "Python" },
  { value: "sql", label: "SQL" },
  { value: "typescript", label: "TypeScript" },
  { value: "xml", label: "HTML/XML" },
] as const;

export const createTaskItemView: NodeViewConstructor = (
  node: PMNode,
  view: EditorView,
  getPos: () => number | undefined,
): NodeView => {
  const dom = document.createElement("li");
  dom.className = "pe-task-item";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "pe-task-checkbox";
  checkbox.contentEditable = "false";
  checkbox.setAttribute("aria-label", "Concluir tarefa");

  const content = document.createElement("div");
  content.className = "pe-task-content";
  dom.append(checkbox, content);

  let currentNode = node;

  const sync = (next: PMNode): void => {
    currentNode = next;
    checkbox.checked = Boolean(next.attrs.checked);
    dom.dataset.checked = String(Boolean(next.attrs.checked));
  };

  checkbox.addEventListener("change", () => {
    const position = getPos();
    if (typeof position !== "number") {
      return;
    }
    view.dispatch(
      view.state.tr.setNodeMarkup(position, undefined, {
        ...currentNode.attrs,
        checked: checkbox.checked,
      }),
    );
  });

  sync(node);

  return {
    dom,
    contentDOM: content,
    update(next) {
      if (next.type !== currentNode.type) {
        return false;
      }
      sync(next);
      return true;
    },
    stopEvent(event) {
      return event.target === checkbox;
    },
    ignoreMutation(mutation) {
      return mutation.target === checkbox || mutation.target === dom;
    },
  };
};

export const createCodeBlockView: NodeViewConstructor = (
  node: PMNode,
  view: EditorView,
  getPos: () => number | undefined,
): NodeView => {
  const dom = document.createElement("div");
  dom.className = "pe-code-block";

  const header = document.createElement("div");
  header.className = "pe-code-header";
  header.contentEditable = "false";

  const exit = document.createElement("button");
  exit.type = "button";
  exit.className = "pe-code-exit";
  exit.textContent = "Sair do código";
  exit.setAttribute("aria-label", "Sair do bloco de código");

  const select = document.createElement("select");
  select.className = "pe-code-language";
  select.setAttribute("aria-label", "Linguagem do bloco de código");
  for (const language of CODE_LANGUAGES) {
    const option = document.createElement("option");
    option.value = language.value;
    option.textContent = language.label;
    select.append(option);
  }
  header.append(exit, select);

  const pre = document.createElement("pre");
  const code = document.createElement("code");
  pre.append(code);
  dom.append(header, pre);

  let currentNode = node;

  const sync = (next: PMNode): void => {
    currentNode = next;
    const language = String(next.attrs.language || "");
    select.value = language;
    code.className = language ? `pe-code-content language-${language}` : "pe-code-content";
  };

  select.addEventListener("change", () => {
    const position = getPos();
    if (typeof position !== "number") {
      return;
    }
    view.dispatch(
      view.state.tr.setNodeMarkup(position, undefined, {
        ...currentNode.attrs,
        language: select.value,
      }),
    );
  });

  exit.addEventListener("click", () => {
    const position = getPos();
    if (typeof position !== "number") {
      return;
    }
    const after = position + currentNode.nodeSize;
    const paragraph = view.state.schema.nodes.paragraph;
    if (!paragraph) {
      return;
    }
    let transaction = view.state.tr.insert(after, paragraph.create());
    transaction = transaction.setSelection(TextSelection.near(transaction.doc.resolve(after + 1)));
    view.dispatch(transaction.scrollIntoView());
    view.focus();
  });

  sync(node);

  return {
    dom,
    contentDOM: code,
    update(next) {
      if (next.type !== currentNode.type) {
        return false;
      }
      sync(next);
      return true;
    },
    stopEvent(event) {
      return event.target === select || (event.target instanceof Node && header.contains(event.target));
    },
    ignoreMutation(mutation) {
      return mutation.target === header || mutation.target === select || (mutation.target instanceof Node && header.contains(mutation.target));
    },
  };
};
