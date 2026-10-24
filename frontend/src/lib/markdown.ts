import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import go from "highlight.js/lib/languages/go";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdownLanguage from "highlight.js/lib/languages/markdown";
import plaintext from "highlight.js/lib/languages/plaintext";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import { markdownIt } from "./markdown-it";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("css", css);
hljs.registerLanguage("go", go);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("markdown", markdownLanguage);
hljs.registerLanguage("plaintext", plaintext);
hljs.registerLanguage("python", python);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("xml", xml);

export function renderMarkdown(source: string): string {
  const html = markdownIt.render(source);

  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target", "rel", "loading", "disabled", "checked", "align"],
    ADD_DATA_URI_TAGS: ["img"],
    FORBID_ATTR: ["style"],
  });
}

export function enhanceContent(container: HTMLElement): void {
  container.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
    if (/^https?:\/\//i.test(link.getAttribute("href") ?? "")) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
  });

  container.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
    image.setAttribute("loading", "lazy");
  });

  container.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
    if (table.parentElement?.classList.contains("table-scroll")) {
      return;
    }
    const wrapper = document.createElement("div");
    wrapper.className = "table-scroll";
    table.parentNode?.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });

  container.querySelectorAll<HTMLElement>("pre code").forEach((code) => {
    try {
      hljs.highlightElement(code);
    } catch {
      // A malformed code block should not break the page.
    }
  });
}
