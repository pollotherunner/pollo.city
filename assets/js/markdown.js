(function () {
  const ESCAPES = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ESCAPES[character]);
  }

  function safeUrl(url) {
    const value = String(url || "").trim();
    if (/^https?:\/\//i.test(value)) return value;
    if (/^mailto:/i.test(value)) return value;
    if (/^(\/|#|\.\/|\.\.\/)/.test(value)) return value;
    return null;
  }

  function renderInline(source) {
    const code = [];
    let value = escapeHTML(source);

    value = value.replace(/`([^`]+)`/g, (match, content) => {
      code.push(`<code>${content}</code>`);
      return `\u0000${code.length - 1}\u0000`;
    });

    value = value.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (match, alt, sourceUrl) => {
      const url = safeUrl(sourceUrl);
      if (!url) return alt;
      return `<img src="${url}" alt="${alt}" loading="lazy">`;
    });

    value = value.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    value = value.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    value = value.replace(/~~([^~]+)~~/g, "<del>$1</del>");
    value = value.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
    value = value.replace(/_([^_\n]+)_/g, "<em>$1</em>");

    value = value.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, sourceUrl) => {
      const url = safeUrl(sourceUrl);
      if (!url) return label;
      const external = /^https?:\/\//i.test(url);
      const attributes = external ? ' target="_blank" rel="noopener noreferrer"' : "";
      return `<a href="${url}"${attributes}>${label}</a>`;
    });

    value = value.replace(/\u0000(\d+)\u0000/g, (match, index) => code[Number(index)] || "");
    return value;
  }

  function isBlockStart(line) {
    return /^(#{1,4}\s|>\s?|```|[-*+]\s+|\d+\.\s+|(?:---|\*\*\*)\s*$)/.test(line);
  }

  function render(source) {
    const lines = String(source || "").replace(/\r\n?/g, "\n").split("\n");
    const output = [];
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];

      if (!line.trim()) {
        index += 1;
        continue;
      }

      const fence = line.match(/^```([\w-]*)\s*$/);
      if (fence) {
        const language = fence[1] ? ` class="language-${fence[1].toLowerCase()}"` : "";
        const block = [];
        index += 1;
        while (index < lines.length && !/^```\s*$/.test(lines[index])) {
          block.push(lines[index]);
          index += 1;
        }
        if (index < lines.length) index += 1;
        output.push(`<pre><code${language}>${escapeHTML(block.join("\n"))}</code></pre>`);
        continue;
      }

      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      if (heading) {
        const level = heading[1].length;
        output.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
        index += 1;
        continue;
      }

      if (/^(?:---|\*\*\*)\s*$/.test(line)) {
        output.push("<hr>");
        index += 1;
        continue;
      }

      if (/^>\s?/.test(line)) {
        const quote = [];
        while (index < lines.length && /^>\s?/.test(lines[index])) {
          quote.push(lines[index].replace(/^>\s?/, ""));
          index += 1;
        }
        output.push(`<blockquote>${render(quote.join("\n"))}</blockquote>`);
        continue;
      }

      if (/^[-*+]\s+/.test(line)) {
        const items = [];
        while (index < lines.length && /^[-*+]\s+/.test(lines[index])) {
          items.push(`<li>${renderInline(lines[index].replace(/^[-*+]\s+/, ""))}</li>`);
          index += 1;
        }
        output.push(`<ul>${items.join("")}</ul>`);
        continue;
      }

      if (/^\d+\.\s+/.test(line)) {
        const items = [];
        while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
          items.push(`<li>${renderInline(lines[index].replace(/^\d+\.\s+/, ""))}</li>`);
          index += 1;
        }
        output.push(`<ol>${items.join("")}</ol>`);
        continue;
      }

      const paragraph = [line.trim()];
      index += 1;
      while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
        paragraph.push(lines[index].trim());
        index += 1;
      }
      output.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    }

    return output.join("\n");
  }

  window.PolloMarkdown = {
    render,
    escapeHTML,
  };
})();
