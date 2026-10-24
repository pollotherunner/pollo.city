import { describe, expect, it } from "vitest";
import { parseMarkdown, serializeMarkdown, UnsupportedMarkdownError } from "./markdown";

function firstBlock(source: string) {
  const doc = parseMarkdown(source);
  const block = doc.firstChild;
  if (!block) {
    throw new Error("expected a block");
  }
  return block;
}

describe("editor markdown", () => {
  it("parses and serializes headings, marks, lists and code", () => {
    const source = [
      "# Título",
      "",
      "Texto **forte**, *itálico*, ~~riscado~~, ++sublinhado++ e `código`.",
      "",
      "> Uma citação.",
      "",
      "- um",
      "- dois",
      "",
      "1. primeiro",
      "2. segundo",
      "",
      "```go",
      'fmt.Println("oi")',
      "```",
      "",
      "---",
      "",
      "[Link](https://example.com) e ![alt](/uploads/image.png)",
      "",
    ].join("\n");

    const output = serializeMarkdown(parseMarkdown(source));

    expect(output).toContain("# Título");
    expect(output).toContain("**forte**");
    expect(output).toContain("*itálico*");
    expect(output).toContain("~~riscado~~");
    expect(output).toContain("++sublinhado++");
    expect(output).toContain("`código`");
    expect(output).toContain("> Uma citação.");
    expect(output).toContain("- um");
    expect(output).toContain("1. primeiro");
    expect(output).toContain("```go");
    expect(output).toContain("---");
    expect(output).toContain("[Link](https://example.com)");
    expect(output).toContain("![alt](/uploads/image.png)");
  });

  it("parses task lists with checked state", () => {
    const list = firstBlock("- [ ] todo\n- [x] done\n");

    expect(list.type.name).toBe("task_list");
    expect(list.childCount).toBe(2);
    expect(list.child(0)?.attrs.checked).toBe(false);
    expect(list.child(1)?.attrs.checked).toBe(true);

    const output = serializeMarkdown(parseMarkdown("- [ ] todo\n- [x] done\n"));
    expect(output).toContain("- [ ] todo");
    expect(output).toContain("- [x] done");
  });

  it("parses tables and preserves alignment", () => {
    const table = firstBlock("| A | B |\n| :--- | ---: |\n| 1 | 2 |\n");

    expect(table.type.name).toBe("table");
    expect(table.childCount).toBe(2);
    expect(table.child(0)?.child(0)?.type.name).toBe("table_header");
    expect(table.child(0)?.child(0)?.attrs.alignment).toBe("left");
    expect(table.child(0)?.child(1)?.attrs.alignment).toBe("right");

    const output = serializeMarkdown(parseMarkdown("| A | B |\n| :--- | ---: |\n| 1 | 2 |\n"));
    expect(output).toContain("| A | B |");
    expect(output).toContain("| :--- | ---: |");
    expect(output).toContain("| 1 | 2 |");
  });

  it("accepts common inline HTML and preserves it as marks", () => {
    const doc = parseMarkdown("<u>sublinhado</u> e <strong>forte</strong>\n");
    const paragraph = doc.firstChild;

    expect(paragraph?.firstChild?.marks[0]?.type.name).toBe("underline");
    expect(serializeMarkdown(doc)).toContain("++sublinhado++");
    expect(serializeMarkdown(doc)).toContain("**forte**");
  });

  it("rejects arbitrary HTML blocks so the editor can fall back to source mode", () => {
    expect(() => parseMarkdown("<div>bloco</div>")).toThrow(UnsupportedMarkdownError);
  });
});
