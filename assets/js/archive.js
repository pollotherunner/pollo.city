(async function () {
  const list = document.querySelector("#archive-list");
  const count = document.querySelector("#archive-count");
  const escape = window.Pollo.escapeHTML;

  try {
    const posts = await window.Pollo.getPosts();
    count.textContent = `${posts.length} ${posts.length === 1 ? "artigo" : "artigos"}`;

    if (!posts.length) {
      list.innerHTML = '<p class="archive-empty">Nenhum artigo publicado.</p>';
      return;
    }

    const groups = new Map();
    posts.forEach((post) => {
      const year = String(post.date || "").slice(0, 4) || "Sem data";
      if (!groups.has(year)) groups.set(year, []);
      groups.get(year).push(post);
    });

    list.innerHTML = [...groups.entries()]
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([year, items]) => `<section class="archive-group">
        <h2 class="archive-year">${escape(year)}</h2>
        <ul class="archive-items">
          ${items.map((post) => `<li>
            <a class="archive-item" href="/post/${encodeURIComponent(post.slug)}">
              <span class="archive-item-title">${escape(post.title)}</span>
              <span class="archive-item-meta">${post.tags.slice(0, 3).map((tag) => `<span>${escape(tag)}</span>`).join("")}<time datetime="${escape(post.date)}">${window.Pollo.formatDate(post.date)}</time></span>
            </a>
          </li>`).join("")}
        </ul>
      </section>`)
      .join("");
  } catch (error) {
    count.textContent = "";
    list.innerHTML = '<p class="archive-empty">Não foi possível carregar o arquivo.</p>';
  }

  window.PolloUI.refreshIcons();
})();
