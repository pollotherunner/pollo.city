(function () {
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[character]));
  }

  function fallbackRender(source) {
    return String(source || "")
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${escapeHTML(paragraph).replace(/\n/g, "<br>")}</p>`)
      .join("");
  }

  function render(source) {
    if (!window.marked || !window.DOMPurify) return fallbackRender(source);

    const html = window.marked.parse(String(source || ""), {
      gfm: true,
      breaks: false,
    });

    return window.DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ["target", "rel", "loading", "disabled", "checked"],
      ADD_DATA_URI_TAGS: ["img"],
      FORBID_ATTR: ["style"],
    });
  }

  window.PolloMarkdown = {
    render,
    escapeHTML,
  };
})();
