import { baseKeymap, toggleMark } from "prosemirror-commands";
import { dropCursor } from "prosemirror-dropcursor";
import { gapCursor } from "prosemirror-gapcursor";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import type { Schema } from "prosemirror-model";
import { liftListItem, sinkListItem, splitListItem } from "prosemirror-schema-list";
import { Plugin, TextSelection, type EditorState } from "prosemirror-state";
import { goToNextCell, isInTable, tableEditing } from "prosemirror-tables";
import { Decoration, DecorationSet } from "prosemirror-view";
import { buildInputRules } from "./input-rules";

interface PluginOptions {
  placeholder: string;
  onLink(): void;
}

function placeholderPlugin(text: string): Plugin {
  return new Plugin({
    props: {
      decorations(state) {
        const { doc } = state;
        if (doc.childCount !== 1) {
          return null;
        }
        const first = doc.firstChild;
        if (!first?.isTextblock || first.content.size > 0) {
          return null;
        }
        const placeholder = document.createElement("span");
        placeholder.className = "pe-placeholder";
        placeholder.textContent = text;
        return DecorationSet.create(doc, [Decoration.widget(1, placeholder)]);
      },
    },
  });
}

function keyboardPlugins(schema: Schema, options: PluginOptions): Plugin[] {
  const strong = schema.marks.strong!;
  const em = schema.marks.em!;
  const underline = schema.marks.underline!;
  const strike = schema.marks.strike!;
  const code = schema.marks.code!;
  const listItem = schema.nodes.list_item!;
  const taskItem = schema.nodes.task_item!;
  const codeBlock = schema.nodes.code_block!;
  const paragraph = schema.nodes.paragraph!;
  const blockquote = schema.nodes.blockquote!;
  const hardBreak = schema.nodes.hard_break!;

  const inNode = (state: EditorState, type: typeof listItem): boolean => {
    const { $from } = state.selection;
    for (let depth = $from.depth; depth >= 0; depth -= 1) {
      if ($from.node(depth).type === type) {
        return true;
      }
    }
    return false;
  };

  return [
    keymap({
      "Mod-z": undo,
      "Shift-Mod-z": redo,
      "Mod-y": redo,
      "Mod-b": toggleMark(strong),
      "Mod-i": toggleMark(em),
      "Mod-u": toggleMark(underline),
      "Mod-Shift-x": toggleMark(strike),
      "Mod-e": toggleMark(code),
      "Mod-k": () => {
        options.onLink();
        return true;
      },
      Tab: (state, dispatch) => {
        if (isInTable(state)) {
          return goToNextCell(1)(state, dispatch);
        }
        return sinkListItem(listItem)(state, dispatch) || sinkListItem(taskItem)(state, dispatch);
      },
      "Shift-Tab": (state, dispatch) => {
        if (isInTable(state)) {
          return goToNextCell(-1)(state, dispatch);
        }
        return liftListItem(listItem)(state, dispatch) || liftListItem(taskItem)(state, dispatch);
      },
      Enter: (state, dispatch) => {
        const { $from } = state.selection;
        if ($from.parent.type === codeBlock) {
          if (dispatch) {
            dispatch(state.tr.replaceSelectionWith(state.schema.text("\n")));
          }
          return true;
        }
        if ($from.parent.content.size === 0 && $from.depth > 1) {
          const quoteDepth = $from.depth - 1;
          const quoteNode = $from.node(quoteDepth);
          if (quoteNode.type === blockquote && $from.index(quoteDepth) === quoteNode.childCount - 1) {
            if (dispatch) {
              const deleteFrom = $from.before($from.depth);
              const deleteTo = $from.after($from.depth);
              let tr = state.tr.delete(deleteFrom, deleteTo);
              const after = tr.mapping.map($from.after(quoteDepth));
              tr = tr.insert(after, paragraph.create());
              tr.setSelection(TextSelection.near(tr.doc.resolve(after + 1)));
              dispatch(tr.scrollIntoView());
            }
            return true;
          }
        }
        if (inNode(state, taskItem)) {
          return splitListItem(taskItem)(state, dispatch);
        }
        if (inNode(state, listItem)) {
          return splitListItem(listItem)(state, dispatch);
        }
        return false;
      },
      "Shift-Enter": (state, dispatch) => {
        const { $from } = state.selection;
        if (dispatch) {
          if ($from.parent.type === codeBlock) {
            dispatch(state.tr.replaceSelectionWith(state.schema.text("\n")));
          } else {
            dispatch(state.tr.replaceSelectionWith(hardBreak.create()).scrollIntoView());
          }
        }
        return true;
      },
      ArrowDown: (state, dispatch) => {
        const { $from } = state.selection;
        if ($from.parent.type !== codeBlock || $from.parentOffset < $from.parent.content.size) {
          return false;
        }
        if (dispatch) {
          const after = $from.after();
          if (after < state.doc.content.size) {
            dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(after + 1))));
          } else {
            const tr = state.tr.insert(after, paragraph.create());
            tr.setSelection(TextSelection.near(tr.doc.resolve(after + 1)));
            dispatch(tr.scrollIntoView());
          }
        }
        return true;
      },
      Escape: (state, dispatch) => {
        const { $from } = state.selection;
        if ($from.parent.type !== codeBlock) {
          return false;
        }
        if (dispatch) {
          const after = $from.after();
          const tr = state.tr.insert(after, paragraph.create());
          tr.setSelection(TextSelection.near(tr.doc.resolve(after + 1)));
          dispatch(tr.scrollIntoView());
        }
        return true;
      },
    }),
  ];
}

export function buildPlugins(schema: Schema, options: PluginOptions): Plugin[] {
  return [
    history(),
    dropCursor(),
    gapCursor(),
    tableEditing(),
    buildInputRules(schema),
    placeholderPlugin(options.placeholder),
    ...keyboardPlugins(schema, options),
    keymap(baseKeymap),
  ];
}
