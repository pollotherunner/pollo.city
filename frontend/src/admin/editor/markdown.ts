import { MarkdownParser, MarkdownSerializer, defaultMarkdownParser, defaultMarkdownSerializer, type MarkdownSerializerState, type ParseSpec } from "prosemirror-markdown";
import type { Attrs, Mark, MarkType, Node as PMNode, NodeType } from "prosemirror-model";
import { markdownIt } from "@/lib/markdown-it";
import { editorSchema } from "./schema";

interface MarkdownToken {
  type: string;
  tag: string;
  content: string;
  attrs: Array<[string, string]> | null;
  children: MarkdownToken[] | null;
  attrGet(name: string): string | null;
}

interface ParseState {
  openNode(type: NodeType, attrs?: Attrs | null): void;
  closeNode(): PMNode | null;
  addNode(type: NodeType, attrs?: Attrs | null, content?: PMNode[]): PMNode | null;
  addText(text: string): void;
  parseTokens(tokens: MarkdownToken[]): void;
  openMark(mark: Mark): void;
  closeMark(markType: MarkType): void;
}

type TokenHandler = (state: ParseState, token: MarkdownToken, tokens: MarkdownToken[], index: number) => void;

export class UnsupportedMarkdownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedMarkdownError";
  }
}

const tokens: Record<string, ParseSpec> = { ...defaultMarkdownParser.tokens };

delete tokens.bullet_list;
delete tokens.ordered_list;
delete tokens.list_item;

tokens.code_block = {
  block: "code_block",
  noCloseToken: true,
  getAttrs: () => ({ language: "" }),
};

tokens.fence = {
  block: "code_block",
  noCloseToken: true,
  getAttrs: (token) => ({ language: token.info || "" }),
};

tokens.s = { mark: "strike" };
tokens.ins = { mark: "underline" };

const nodeTypes = {
  taskList: editorSchema.nodes.task_list!,
  taskItem: editorSchema.nodes.task_item!,
  table: editorSchema.nodes.table!,
  tableRow: editorSchema.nodes.table_row!,
  tableHeader: editorSchema.nodes.table_header!,
  tableCell: editorSchema.nodes.table_cell!,
  paragraph: editorSchema.nodes.paragraph!,
  listItem: editorSchema.nodes.list_item!,
  bulletList: editorSchema.nodes.bullet_list!,
  orderedList: editorSchema.nodes.ordered_list!,
  hardBreak: editorSchema.nodes.hard_break!,
};

const markTypes = {
  underline: editorSchema.marks.underline!,
  strong: editorSchema.marks.strong!,
  em: editorSchema.marks.em!,
  strike: editorSchema.marks.strike!,
  code: editorSchema.marks.code!,
  link: editorSchema.marks.link!,
};

const parser = new MarkdownParser(editorSchema, markdownIt, tokens);
const parserInternals = parser as unknown as { tokenHandlers: Record<string, TokenHandler> };
const listKinds = new WeakMap<ParseState, string[]>();

function listStack(state: ParseState): string[] {
  let stack = listKinds.get(state);
  if (!stack) {
    stack = [];
    listKinds.set(state, stack);
  }
  return stack;
}

function currentList(state: ParseState): string | undefined {
  return listStack(state).at(-1);
}

function taskItemChecked(tokens: MarkdownToken[], index: number): boolean {
  for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
    const token = tokens[cursor];
    if (!token || token.type === "list_item_close") {
      break;
    }
    if (token.type !== "inline") {
      continue;
    }
    const checkbox = token.children?.find(
      (child) => child.type === "html_inline" && child.content.includes("task-list-item-checkbox"),
    );
    return checkbox?.content.includes("checked") ?? false;
  }
  return false;
}

function tableAlignment(token: MarkdownToken): string | null {
  const style = token.attrGet("style");
  const match = style ? /text-align:\s*(left|center|right)/.exec(String(style)) : null;
  return match?.[1] ?? null;
}

function openTableRow(state: ParseState): void {
  state.openNode(nodeTypes.tableRow);
}

function openTableCell(state: ParseState, token: MarkdownToken, type: NodeType): void {
  state.openNode(type, { alignment: tableAlignment(token) });
  state.openNode(nodeTypes.paragraph);
}

function closeTableCell(state: ParseState): void {
  state.closeNode();
  state.closeNode();
}

const customHandlers: Record<string, TokenHandler> = {
  bullet_list_open: (state, token) => {
    const isTaskList = token.attrGet("class")?.includes("contains-task-list") ?? false;
    const type = isTaskList ? nodeTypes.taskList : nodeTypes.bulletList;
    listStack(state).push(type.name);
    state.openNode(type);
  },
  bullet_list_close: (state) => {
    listStack(state).pop();
    state.closeNode();
  },
  ordered_list_open: (state, token) => {
    listStack(state).push("ordered_list");
    state.openNode(nodeTypes.orderedList, { order: Number(token.attrGet("start")) || 1 });
  },
  ordered_list_close: (state) => {
    listStack(state).pop();
    state.closeNode();
  },
  list_item_open: (state, _token, allTokens, index) => {
    if (currentList(state) === "task_list") {
      state.openNode(nodeTypes.taskItem, { checked: taskItemChecked(allTokens, index) });
      return;
    }
    state.openNode(nodeTypes.listItem);
  },
  list_item_close: (state) => {
    state.closeNode();
  },
  table_open: (state) => {
    state.openNode(nodeTypes.table);
  },
  table_close: (state) => {
    state.closeNode();
  },
  thead_open: () => undefined,
  thead_close: () => undefined,
  tbody_open: () => undefined,
  tbody_close: () => undefined,
  tr_open: (state) => {
    openTableRow(state);
  },
  tr_close: (state) => {
    state.closeNode();
  },
  th_open: (state, token) => {
    openTableCell(state, token, nodeTypes.tableHeader);
  },
  th_close: (state) => {
    closeTableCell(state);
  },
  td_open: (state, token) => {
    openTableCell(state, token, nodeTypes.tableCell);
  },
  td_close: (state) => {
    closeTableCell(state);
  },
  html_block: (_state, token) => {
    throw new UnsupportedMarkdownError(`HTML block não suportado: ${token.content.slice(0, 80)}`);
  },
  html_inline: (state, token, allTokens, index) => {
    const content = token.content.trim();
    if (content.includes("task-list-item-checkbox")) {
      const next = allTokens[index + 1];
      if (next?.type === "text") {
        next.content = next.content.replace(/^\s+/, "");
      }
      return;
    }
    if (!content) {
      return;
    }
    if (/^<br\s*\/?>$/i.test(content)) {
      state.addNode(nodeTypes.hardBreak);
      return;
    }
    if (content === "<u>" || content === "<ins>") {
      state.openMark(markTypes.underline.create());
      return;
    }
    if (content === "</u>" || content === "</ins>") {
      state.closeMark(markTypes.underline);
      return;
    }
    if (content === "<strong>" || content === "<b>") {
      state.openMark(markTypes.strong.create());
      return;
    }
    if (content === "</strong>" || content === "</b>") {
      state.closeMark(markTypes.strong);
      return;
    }
    if (content === "<em>" || content === "<i>") {
      state.openMark(markTypes.em.create());
      return;
    }
    if (content === "</em>" || content === "</i>") {
      state.closeMark(markTypes.em);
      return;
    }
    if (content === "<s>" || content === "<del>") {
      state.openMark(markTypes.strike.create());
      return;
    }
    if (content === "</s>" || content === "</del>") {
      state.closeMark(markTypes.strike);
      return;
    }
    if (content === "<code>") {
      state.openMark(markTypes.code.create());
      return;
    }
    if (content === "</code>") {
      state.closeMark(markTypes.code);
      return;
    }

    const link = /^<a\s+[^>]*href="([^"]*)"[^>]*>$/i.exec(content);
    if (link?.[1]) {
      state.openMark(markTypes.link.create({ href: link[1] }));
      return;
    }
    if (content === "</a>") {
      state.closeMark(markTypes.link);
      return;
    }

    throw new UnsupportedMarkdownError(`HTML inline não suportado: ${content.slice(0, 80)}`);
  },
};

Object.assign(parserInternals.tokenHandlers, customHandlers);

export function parseMarkdown(source: string): PMNode {
  return parser.parse(source);
}

function columnAlignment(rows: PMNode[], column: number): string | null {
  for (const row of rows) {
    const cell = row.child(Math.min(column, row.childCount - 1));
    if (cell?.attrs.alignment) {
      return String(cell.attrs.alignment);
    }
  }
  return null;
}

const nodes = {
  ...defaultMarkdownSerializer.nodes,

  code_block(state: MarkdownSerializerState, node: PMNode): void {
    const backticks = node.textContent.match(/`{3,}/gm);
    const fence = backticks ? `${backticks.sort().slice(-1)[0]}\`` : "```";
    state.write(`${fence}${node.attrs.language || ""}\n`);
    state.text(node.textContent, false);
    state.write("\n");
    state.write(fence);
    state.closeBlock(node);
  },

  bullet_list(state: MarkdownSerializerState, node: PMNode): void {
    state.renderList(node, "  ", () => "- ");
  },

  task_list(state: MarkdownSerializerState, node: PMNode): void {
    state.renderList(node, "  ", () => "- ");
  },

  task_item(state: MarkdownSerializerState, node: PMNode): void {
    const startsWithSpace = (node.firstChild?.textContent ?? "").startsWith(" ");
    state.write(`${node.attrs.checked ? "[x]" : "[ ]"}${startsWithSpace ? "" : " "}`);
    state.renderContent(node);
  },

  table(state: MarkdownSerializerState, node: PMNode): void {
    const rows: PMNode[] = [];
    node.forEach((row) => rows.push(row));
    if (!rows.length) {
      return;
    }

    const columns = Math.max(...rows.map((row) => row.childCount));
    const header = rows[0];
    if (!header) {
      return;
    }
    const headerCells: string[] = [];
    const separators: string[] = [];

    for (let column = 0; column < columns; column += 1) {
      const cell = header.child(Math.min(column, header.childCount - 1));
      headerCells.push(cell ? cellMarkdown(cell) || " " : " ");
      const alignment = columnAlignment(rows, column);
      separators.push(alignment === "center" ? ":---:" : alignment === "right" ? "---:" : alignment === "left" ? ":---" : "---");
    }

    state.write(`| ${headerCells.join(" | ")} |\n`);
    state.write(`| ${separators.join(" | ")} |\n`);

    for (const row of rows.slice(1)) {
      const cells: string[] = [];
      for (let column = 0; column < columns; column += 1) {
        const cell = row.child(Math.min(column, row.childCount - 1));
        cells.push(cell ? cellMarkdown(cell) || " " : " ");
      }
      state.write(`| ${cells.join(" | ")} |\n`);
    }

    state.closeBlock(node);
  },

  table_row: (): void => undefined,
  table_cell: (): void => undefined,
  table_header: (): void => undefined,
};

const marks = {
  ...defaultMarkdownSerializer.marks,
  strike: { open: "~~", close: "~~", mixable: true, expelEnclosingWhitespace: true },
  underline: { open: "++", close: "++", mixable: true, expelEnclosingWhitespace: true },
};

const serializer = new MarkdownSerializer(nodes, marks);

function cellMarkdown(cell: PMNode): string {
  const parts: string[] = [];
  cell.forEach((child) => {
    if (child.isTextblock) {
      const doc = editorSchema.nodes.doc!.create(null, [child]);
      parts.push(serializer.serialize(doc, { tightLists: true }).trim());
      return;
    }
    parts.push(child.textContent.trim());
  });
  return parts
    .join(" ")
    .replace(/\|/g, "\\|")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}

export function serializeMarkdown(doc: PMNode): string {
  return serializer.serialize(doc, { tightLists: true });
}
