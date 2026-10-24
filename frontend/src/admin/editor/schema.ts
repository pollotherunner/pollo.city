import { Schema, type MarkSpec, type NodeSpec } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { addListNodes } from "prosemirror-schema-list";
import { tableNodes } from "prosemirror-tables";

const strike: MarkSpec = {
  parseDOM: [{ tag: "s" }, { tag: "del" }, { style: "text-decoration=line-through" }],
  toDOM: () => ["s", 0],
};

const underline: MarkSpec = {
  parseDOM: [{ tag: "u" }, { tag: "ins" }],
  toDOM: () => ["u", 0],
};

const taskList: NodeSpec = {
  content: "task_item+",
  group: "block",
  defining: true,
  parseDOM: [{ tag: "ul[data-type=task-list]" }],
  toDOM() {
    return ["ul", { "data-type": "task-list" }, 0];
  },
};

const taskItem: NodeSpec = {
  attrs: { checked: { default: false } },
  content: "paragraph block*",
  defining: true,
  parseDOM: [
    {
      tag: "li[data-type=task-item]",
      getAttrs: (dom) => ({ checked: (dom as HTMLElement).getAttribute("data-checked") === "true" }),
    },
  ],
  toDOM(node) {
    return ["li", { "data-type": "task-item", "data-checked": String(node.attrs.checked) }, 0];
  },
};

const codeBlock: NodeSpec = {
  content: "text*",
  marks: "",
  group: "block",
  code: true,
  defining: true,
  attrs: { language: { default: "" } },
  parseDOM: [
    {
      tag: "pre",
      preserveWhitespace: "full",
      getAttrs: (dom) => ({ language: (dom as HTMLElement).getAttribute("data-language") ?? "" }),
    },
  ],
  toDOM(node) {
    return [
      "pre",
      { "data-language": node.attrs.language || null },
      ["code", { class: node.attrs.language ? `language-${node.attrs.language}` : null }, 0],
    ];
  },
};

const tableSpec = tableNodes({
  tableGroup: "block",
  cellContent: "block+",
  cellAttributes: {
    alignment: {
      default: null,
      getFromDOM: (dom) => dom.getAttribute("data-alignment"),
      setDOMAttr: (value, attrs) => {
        if (value) {
          attrs["data-alignment"] = value;
        }
      },
    },
  },
});

let nodes = addListNodes(basicSchema.spec.nodes, "paragraph block*", "block")
  .update("code_block", codeBlock)
  .addToEnd("task_list", taskList)
  .addToEnd("task_item", taskItem);

for (const [name, spec] of Object.entries(tableSpec)) {
  nodes = nodes.addToEnd(name, spec);
}

const marks = basicSchema.spec.marks.addToEnd("strike", strike).addToEnd("underline", underline);

export const editorSchema = new Schema({ nodes, marks });
