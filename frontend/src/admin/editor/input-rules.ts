import { InputRule, inputRules, textblockTypeInputRule, wrappingInputRule } from "prosemirror-inputrules";
import type { MarkType, NodeType, Schema } from "prosemirror-model";

function nodeType(schema: Schema, name: string): NodeType {
  const type = schema.nodes[name];
  if (!type) {
    throw new Error(`Unknown node type: ${name}`);
  }
  return type;
}

function markType(schema: Schema, name: string): MarkType {
  const type = schema.marks[name];
  if (!type) {
    throw new Error(`Unknown mark type: ${name}`);
  }
  return type;
}

function markInputRule(regexp: RegExp, mark: MarkType): InputRule {
  return new InputRule(regexp, (state, match, start, end) => {
    const text = match[1] ?? "";
    if (!text) {
      return null;
    }
    return state.tr.replaceWith(start, end, state.schema.text(text, [mark.create()]));
  });
}

export function buildInputRules(schema: Schema) {
  const heading = nodeType(schema, "heading");
  const blockquote = nodeType(schema, "blockquote");
  const bulletList = nodeType(schema, "bullet_list");
  const orderedList = nodeType(schema, "ordered_list");
  const codeBlock = nodeType(schema, "code_block");
  const horizontalRule = nodeType(schema, "horizontal_rule");
  const image = nodeType(schema, "image");

  return inputRules({
    rules: [
      textblockTypeInputRule(/^(#{1,6})\s$/, heading, (match) => ({ level: match[1]?.length ?? 1 })),
      wrappingInputRule(/^\s*>\s$/, blockquote),
      wrappingInputRule(/^\s*([-+*])\s$/, bulletList),
      wrappingInputRule(/^(\d+)\.\s$/, orderedList, (match) => ({ order: Number(match[1]) || 1 })),
      textblockTypeInputRule(/^```([a-zA-Z0-9+#-]*)\s$/, codeBlock, (match) => ({ language: match[1] ?? "" })),
      new InputRule(/^(?:---|\*\*\*|___)$/, (state, _match, start, end) =>
        state.tr.replaceWith(start, end, horizontalRule.create()),
      ),
      markInputRule(/(?:\*\*|__)([^*_\n]+)(?:\*\*|__)$/, markType(schema, "strong")),
      markInputRule(/(?<!\*)\*([^*\n]+)\*(?!\*)$/, markType(schema, "em")),
      markInputRule(/(?<!_)_([^_\n]+)_(?!_)$/, markType(schema, "em")),
      markInputRule(/(?<!~)~~([^~\n]+)~~(?!~)$/, markType(schema, "strike")),
      markInputRule(/(?<!\+)\+\+([^+\n]+)\+\+(?!\+)$/, markType(schema, "underline")),
      markInputRule(/`([^`\n]+)`$/, markType(schema, "code")),
      new InputRule(/!\[([^\]\n]*)\]\(([^)\s]+)\)$/, (state, match, start, end) =>
        state.tr.replaceWith(
          start,
          end,
          image.create({ src: match[2] ?? "", alt: match[1] || null, title: null }),
        ),
      ),
      new InputRule(/\[([^\]\n]+)\]\(([^)\s]+)\)$/, (state, match, start, end) =>
        state.tr.replaceWith(
          start,
          end,
          state.schema.text(match[1] ?? "", [markType(schema, "link").create({ href: match[2] ?? "" })]),
        ),
      ),
    ],
  });
}
