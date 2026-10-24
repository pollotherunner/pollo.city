import { lift, setBlockType, toggleMark, wrapIn } from "prosemirror-commands";
import { redo, redoDepth, undo, undoDepth } from "prosemirror-history";
import type { Node, NodeType, Schema } from "prosemirror-model";
import { liftListItem, wrapInList } from "prosemirror-schema-list";
import { TextSelection, type Command, type EditorState, type Transaction } from "prosemirror-state";
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  deleteColumn,
  deleteRow,
  deleteTable,
  isInTable,
  setCellAttr,
  toggleHeaderRow,
} from "prosemirror-tables";
import type { EditorView } from "prosemirror-view";
import { refreshIcons } from "@/lib/icons";

interface ToolbarOptions {
  schema: Schema;
  getView(): EditorView | null;
  onLink(): void;
  onImage(): void;
  onImageUrl(): void;
}

export interface EditorToolbar {
  dom: HTMLElement;
  update(state: EditorState): void;
}

function button(action: string, label: string, icon: string): string {
  return `<button class="pe-button" type="button" data-action="${action}" title="${label}" aria-label="${label}"><i data-lucide="${icon}"></i></button>`;
}

function tableButton(action: string, label: string, icon: string): string {
  return `<button class="pe-button pe-table-button" type="button" data-table-action="${action}" title="${label}" aria-label="${label}"><i data-lucide="${icon}"></i></button>`;
}

export function createToolbar(options: ToolbarOptions): EditorToolbar {
  const { schema } = options;
  const dom = document.createElement("div");
  dom.className = "pe-toolbar";
  dom.setAttribute("role", "toolbar");
  dom.setAttribute("aria-label", "Formatação");

  dom.innerHTML = `
    <select class="pe-block-select" aria-label="Estilo do bloco">
      <option value="paragraph">Parágrafo</option>
      <option value="1">Título 1</option>
      <option value="2">Título 2</option>
      <option value="3">Título 3</option>
      <option value="4">Título 4</option>
      <option value="5">Título 5</option>
      <option value="6">Título 6</option>
    </select>
    <span class="pe-toolbar-separator" aria-hidden="true"></span>
    <div class="pe-toolbar-group">
      ${button("bold", "Negrito (Ctrl+B)", "bold")}
      ${button("italic", "Itálico (Ctrl+I)", "italic")}
      ${button("strike", "Riscado", "strikethrough")}
      ${button("underline", "Sublinhado (Ctrl+U)", "underline")}
      ${button("code", "Código inline (Ctrl+E)", "code")}
      ${button("link", "Link (Ctrl+K)", "link")}
    </div>
    <span class="pe-toolbar-separator" aria-hidden="true"></span>
    <div class="pe-toolbar-group">
      ${button("quote", "Citação", "quote")}
      ${button("ul", "Lista com marcadores", "list")}
      ${button("ol", "Lista numerada", "list-ordered")}
      ${button("task", "Lista de tarefas", "list-checks")}
      ${button("codeblock", "Bloco de código", "square-code")}
    </div>
    <span class="pe-toolbar-separator" aria-hidden="true"></span>
    <div class="pe-toolbar-group">
      ${button("table", "Inserir tabela", "table")}
      ${button("hr", "Divisória", "minus")}
      ${button("image", "Enviar imagem", "image")}
      ${button("image-url", "Imagem por URL", "image-plus")}
    </div>
    <span class="pe-toolbar-separator" aria-hidden="true"></span>
    <div class="pe-toolbar-group">
      ${button("undo", "Desfazer (Ctrl+Z)", "undo-2")}
      ${button("redo", "Refazer (Ctrl+Shift+Z)", "redo-2")}
      ${button("clear", "Limpar formatação", "remove-formatting")}
    </div>
    <div class="pe-table-tools" hidden>
      <span class="pe-toolbar-label">Tabela</span>
      ${tableButton("row-before", "Adicionar linha acima", "between-horizontal-start")}
      ${tableButton("row-after", "Adicionar linha abaixo", "between-horizontal-end")}
      ${tableButton("row-delete", "Excluir linha", "rows-3")}
      ${tableButton("column-before", "Adicionar coluna à esquerda", "between-vertical-start")}
      ${tableButton("column-after", "Adicionar coluna à direita", "between-vertical-end")}
      ${tableButton("column-delete", "Excluir coluna", "columns-3")}
      ${tableButton("header", "Alternar cabeçalho", "panel-top")}
      ${tableButton("align-left", "Alinhar à esquerda", "align-left")}
      ${tableButton("align-center", "Centralizar", "align-center")}
      ${tableButton("align-right", "Alinhar à direita", "align-right")}
      ${tableButton("delete", "Excluir tabela", "trash-2")}
    </div>`;

  refreshIcons(dom);

  const blockSelect = dom.querySelector<HTMLSelectElement>(".pe-block-select");
  const tableTools = dom.querySelector<HTMLElement>(".pe-table-tools");
  if (!blockSelect || !tableTools) {
    throw new Error("Toolbar markup is incomplete");
  }

  const paragraph = schema.nodes.paragraph!;
  const heading = schema.nodes.heading!;
  const blockquote = schema.nodes.blockquote!;
  const bulletList = schema.nodes.bullet_list!;
  const orderedList = schema.nodes.ordered_list!;
  const taskList = schema.nodes.task_list!;
  const listItem = schema.nodes.list_item!;
  const taskItem = schema.nodes.task_item!;
  const codeBlock = schema.nodes.code_block!;
  const horizontalRule = schema.nodes.horizontal_rule!;
  const table = schema.nodes.table!;
  const tableRow = schema.nodes.table_row!;
  const tableHeader = schema.nodes.table_header!;
  const tableCell = schema.nodes.table_cell!;

  const strong = schema.marks.strong!;
  const em = schema.marks.em!;
  const strike = schema.marks.strike!;
  const underline = schema.marks.underline!;
  const code = schema.marks.code!;
  const link = schema.marks.link!;

  const run = (command: Command): void => {
    const view = options.getView();
    if (!view) {
      return;
    }
    command(view.state, view.dispatch, view);
    view.focus();
  };

  const inNode = (state: EditorState, type: NodeType): boolean => {
    const { $from } = state.selection;
    for (let depth = $from.depth; depth >= 0; depth -= 1) {
      if ($from.node(depth).type === type) {
        return true;
      }
    }
    return false;
  };

  const inAnyList = (state: EditorState): boolean => inNode(state, listItem) || inNode(state, taskItem);

  const toggleBlockquote: Command = (state, dispatch) => {
    if (inNode(state, blockquote)) {
      return lift(state, dispatch);
    }
    return wrapIn(blockquote)(state, dispatch);
  };

  const toggleList = (listType: NodeType, itemType: NodeType): Command => (state, dispatch) => {
    if (inNode(state, listType)) {
      return liftListItem(itemType)(state, dispatch);
    }
    if (inAnyList(state) && dispatch) {
      const currentItem = inNode(state, taskList) ? taskItem : listItem;
      return liftListItem(currentItem)(state, (transaction) => {
        wrapInList(listType)(state.apply(transaction), dispatch, options.getView() ?? undefined);
      });
    }
    return wrapInList(listType)(state, dispatch);
  };

  const toggleCodeBlock: Command = (state, dispatch) => {
    if (state.selection.$from.parent.type === codeBlock) {
      return setBlockType(paragraph)(state, dispatch);
    }
    return setBlockType(codeBlock, { language: "" })(state, dispatch);
  };

  const insertBlock = (state: EditorState, block: Node, selectAfter: boolean): Transaction => {
    const { $from } = state.selection;
    const topDepth = Math.min(1, $from.depth);
    const topNode = $from.node(topDepth);
    const topStart = $from.before(topDepth);
    const topEnd = $from.after(topDepth);
    const replacesEmptyParagraph = topNode.type === paragraph && topNode.content.size === 0;
    const insertPos = replacesEmptyParagraph ? topStart : topEnd;
    let tr = replacesEmptyParagraph ? state.tr.replaceWith(topStart, topEnd, block) : state.tr.insert(topEnd, block);
    const paragraphPos = insertPos + block.nodeSize;
    tr = tr.insert(paragraphPos, paragraph.create());
    tr = tr.setSelection(
      TextSelection.near(tr.doc.resolve(selectAfter ? paragraphPos + 1 : insertPos + 4)),
    );
    return tr;
  };

  const insertTable = (state: EditorState, dispatch?: (transaction: Transaction) => void): boolean => {
    const makeRow = (cellType: NodeType): Node =>
      tableRow.create(
        null,
        Array.from({ length: 3 }, () => cellType.create(null, [paragraph.create()])),
      );
    const next = table.create(null, [makeRow(tableHeader), makeRow(tableCell), makeRow(tableCell)]);
    if (dispatch) {
      dispatch(insertBlock(state, next, false).scrollIntoView());
    }
    return true;
  };

  const insertRule: Command = (state, dispatch) => {
    if (dispatch) {
      dispatch(insertBlock(state, horizontalRule.create(), true).scrollIntoView());
    }
    return true;
  };

  const clearFormatting: Command = (state, dispatch) => {
    const { from, to, empty } = state.selection;
    if (dispatch) {
      dispatch(empty ? state.tr.setStoredMarks([]) : state.tr.removeMark(from, to));
    }
    return true;
  };

  const commandForTableAction = (action: string): Command | null => {
    switch (action) {
      case "row-before":
        return addRowBefore;
      case "row-after":
        return addRowAfter;
      case "row-delete":
        return deleteRow;
      case "column-before":
        return addColumnBefore;
      case "column-after":
        return addColumnAfter;
      case "column-delete":
        return deleteColumn;
      case "header":
        return toggleHeaderRow;
      case "delete":
        return deleteTable;
      case "align-left":
        return setCellAttr("alignment", "left");
      case "align-center":
        return setCellAttr("alignment", "center");
      case "align-right":
        return setCellAttr("alignment", "right");
      default:
        return null;
    }
  };

  blockSelect.addEventListener("change", () => {
    const value = blockSelect.value;
    if (value === "paragraph") {
      run(setBlockType(paragraph));
      return;
    }
    run(setBlockType(heading, { level: Number(value) }));
  });

  dom.addEventListener("mousedown", (event) => {
    if (event.target instanceof Element && event.target.closest("button")) {
      event.preventDefault();
    }
  });

  dom.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const tableButtonElement = event.target.closest<HTMLButtonElement>("[data-table-action]");
    if (tableButtonElement?.dataset.tableAction) {
      const command = commandForTableAction(tableButtonElement.dataset.tableAction);
      if (command) {
        run(command);
      }
      return;
    }

    const element = event.target.closest<HTMLButtonElement>("[data-action]");
    const action = element?.dataset.action;
    if (!action) {
      return;
    }

    switch (action) {
      case "bold":
        run(toggleMark(strong));
        break;
      case "italic":
        run(toggleMark(em));
        break;
      case "strike":
        run(toggleMark(strike));
        break;
      case "underline":
        run(toggleMark(underline));
        break;
      case "code":
        run(toggleMark(code));
        break;
      case "link":
        options.onLink();
        break;
      case "quote":
        run(toggleBlockquote);
        break;
      case "ul":
        run(toggleList(bulletList, listItem));
        break;
      case "ol":
        run(toggleList(orderedList, listItem));
        break;
      case "task":
        run(toggleList(taskList, taskItem));
        break;
      case "codeblock":
        run(toggleCodeBlock);
        break;
      case "table":
        run(insertTable);
        break;
      case "hr":
        run(insertRule);
        break;
      case "image":
        options.onImage();
        break;
      case "image-url":
        options.onImageUrl();
        break;
      case "undo":
        run(undo);
        break;
      case "redo":
        run(redo);
        break;
      case "clear":
        run(clearFormatting);
        break;
    }
  });

  const setPressed = (action: string, pressed: boolean): void => {
    const element = dom.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
    element?.setAttribute("aria-pressed", String(pressed));
  };

  const markActive = (state: EditorState, type: typeof strong): boolean => {
    const { from, to, empty, $from } = state.selection;
    if (empty) {
      return Boolean(type.isInSet(state.storedMarks ?? $from.marks()));
    }
    return state.doc.rangeHasMark(from, to, type);
  };

  const update = (state: EditorState): void => {
    setPressed("bold", markActive(state, strong));
    setPressed("italic", markActive(state, em));
    setPressed("strike", markActive(state, strike));
    setPressed("underline", markActive(state, underline));
    setPressed("code", markActive(state, code));
    setPressed("link", markActive(state, link));
    setPressed("quote", inNode(state, blockquote));
    setPressed("ul", inNode(state, bulletList));
    setPressed("ol", inNode(state, orderedList));
    setPressed("task", inNode(state, taskList));
    setPressed("codeblock", state.selection.$from.parent.type === codeBlock);

    const parent = state.selection.$from.parent;
    blockSelect.value = parent.type === heading ? String(parent.attrs.level) : "paragraph";

    const undoButton = dom.querySelector<HTMLButtonElement>('[data-action="undo"]');
    const redoButton = dom.querySelector<HTMLButtonElement>('[data-action="redo"]');
    if (undoButton) {
      undoButton.disabled = undoDepth(state) === 0;
    }
    if (redoButton) {
      redoButton.disabled = redoDepth(state) === 0;
    }

    const tableMode = isInTable(state);
    tableTools.hidden = !tableMode;
    if (tableMode) {
      dom.querySelectorAll<HTMLButtonElement>("[data-table-action]").forEach((element) => {
        const action = element.dataset.tableAction;
        const command = action ? commandForTableAction(action) : null;
        element.disabled = command ? !command(state) : false;
      });
    }
  };

  return { dom, update };
}
