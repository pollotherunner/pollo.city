import { describe, expect, it } from "vitest";
import { countWords, initials, readingMinutes } from "./strings";

describe("strings", () => {
  it("counts words without markdown punctuation", () => {
    expect(countWords("## Olá\n\nConteúdo **forte**.")).toBe(3);
    expect(countWords("")).toBe(0);
  });

  it("returns at least one reading minute", () => {
    expect(readingMinutes("")).toBe(1);
    expect(readingMinutes("palavra ".repeat(210))).toBe(1);
    expect(readingMinutes("palavra ".repeat(211))).toBe(2);
  });

  it("builds initials from names", () => {
    expect(initials("Pollo")).toBe("PO");
    expect(initials("Gabriel Silva")).toBe("GS");
    expect(initials("")).toBe("?");
  });
});
