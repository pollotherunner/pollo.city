// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { enhanceContent, renderMarkdown } from "./markdown";

function render(source: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = renderMarkdown(source);
  enhanceContent(container);
  return container;
}

describe("markdown", () => {
  it("renders GFM tables and keeps their alignment", () => {
    const container = render("| A | B |\n| :--- | ---: |\n| 1 | 2 |\n");
    const cells = container.querySelectorAll("th, td");

    expect(cells).toHaveLength(4);
    expect(cells[0]?.getAttribute("align")).toBe("left");
    expect(cells[1]?.getAttribute("align")).toBe("right");
    expect(container.innerHTML).not.toContain("style=");
  });

  it("renders task lists, strikethrough and code fences", () => {
    const container = render("- [ ] todo\n- [x] done\n\n~~riscado~~\n\n```js\nconst x = 1;\n```\n");

    expect(container.querySelectorAll("input[type=checkbox]")).toHaveLength(2);
    expect(container.querySelector("li.task-list-item")).not.toBeNull();
    expect(container.querySelector("del")?.textContent).toBe("riscado");
    expect(container.querySelector("pre code")?.className).toContain("language-js");
    expect(container.querySelector("pre code")?.className).toContain("hljs");
  });

  it("sanitizes raw HTML and unsafe attributes", () => {
    const container = render('<script>alert("x")</script><img src="x" onerror="alert(1)" style="color:red">');

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")?.getAttribute("onerror")).toBeNull();
    expect(container.querySelector("img")?.getAttribute("style")).toBeNull();
  });

  it("adds safe attributes to external links and images", () => {
    const container = render("Veja www.example.com\n\n![alt](/uploads/image.png)");

    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("http://www.example.com");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(container.querySelector("img")?.getAttribute("loading")).toBe("lazy");
  });
});
