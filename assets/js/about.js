(async function () {
  const title = document.querySelector("#sobre-title");
  const lede = document.querySelector("#sobre-lede");
  const body = document.querySelector("#sobre-body");
  const description = document.querySelector('meta[name="description"]');

  try {
    const about = await window.Pollo.getAbout();
    if (!about) return;

    title.textContent = about.title || "Sobre";
    lede.textContent = about.lede || "";
    lede.hidden = !about.lede;
    document.title = `${title.textContent} — pollo.city`;
    if (description && about.lede) description.setAttribute("content", about.lede);

    if (!about.body.trim()) {
      body.hidden = true;
      return;
    }

    body.innerHTML = window.PolloMarkdown.render(about.body);
    body.hidden = false;

    body.querySelectorAll("a[href]").forEach((link) => {
      if (/^https?:\/\//i.test(link.getAttribute("href"))) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
    });

    body.querySelectorAll("img").forEach((image) => {
      image.loading = "lazy";
    });

    body.querySelectorAll("table").forEach((table) => {
      if (table.parentElement.classList.contains("table-scroll")) return;
      const wrapper = document.createElement("div");
      wrapper.className = "table-scroll";
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });

    if (window.hljs) {
      body.querySelectorAll("pre code").forEach((code) => {
        try {
          window.hljs.highlightElement(code);
        } catch (error) {
          void error;
        }
      });
    }

    window.PolloUI.refreshIcons();
  } catch (error) {
    void error;
  }
})();
