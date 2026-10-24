import { describe, expect, it } from "vitest";
import { normalizeTags, tagSlug } from "./tags";

describe("tags", () => {
  it("normalizes accents, hashes and whitespace", () => {
    expect(tagSlug("  #Ação  ")).toBe("acao");
    expect(normalizeTags(["Ação", "acao", "  Design  "])).toEqual(["Ação", "Design"]);
  });

  it("limits the list to eight tags", () => {
    expect(normalizeTags(["um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"])).toHaveLength(8);
  });
});
