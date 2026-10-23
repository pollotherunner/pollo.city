(function () {
  const ADMIN_PASSWORD = "pollo2026";
  const SESSION_KEY = "pollo.admin.session.v1";
  const state = {
    draftId: null,
    postSlug: null,
    thumbnail: "",
    tags: [],
    editorOpen: false,
    dirty: false,
    autosaveTimer: null,
  };

  const authView = document.querySelector("#auth-view");
  const adminView = document.querySelector("#admin-view");
  const dashboardView = document.querySelector("#dashboard-view");
  const editorView = document.querySelector("#editor-view");
  const loginForm = document.querySelector("#login-form");
  const passwordField = document.querySelector("#admin-password");
  const passwordToggle = document.querySelector("#password-toggle");
  const loginError = document.querySelector("#login-error");
  const logoutButton = document.querySelector("#logout-button");
  const newArticleButton = document.querySelector("#new-article-button");
  const publishedList = document.querySelector("#published-list");
  const draftsList = document.querySelector("#drafts-list");
  const publishedCount = document.querySelector("#published-count");
  const draftsCount = document.querySelector("#drafts-count");
  const adminFeedback = document.querySelector("#admin-feedback");
  const adminFeedbackMessage = adminFeedback.querySelector(".feedback-message");
  const adminFeedbackMark = adminFeedback.querySelector(".feedback-mark");
  const publishedLink = document.querySelector("#published-link");
  const exportButton = document.querySelector("#export-button");
  const importButton = document.querySelector("#import-button");
  const importInput = document.querySelector("#import-input");
  const editorBack = document.querySelector("#editor-back");
  const saveDraftButton = document.querySelector("#save-draft-button");
  const publishButton = document.querySelector("#publish-button");
  const saveState = document.querySelector("#editor-save-state");
  const titleField = document.querySelector("#editor-title");
  const tagChips = document.querySelector("#editor-tag-chips");
  const tagInput = document.querySelector("#tag-input");
  const tagSuggestions = document.querySelector("#tag-suggestions");
  const coverPreview = document.querySelector("#cover-preview");
  const coverButton = document.querySelector("#cover-button");
  const coverButtonLabel = document.querySelector("#cover-button-label");
  const coverInput = document.querySelector("#cover-input");
  const editorContent = document.querySelector("#editor-content");
  const toolbar = document.querySelector(".editor-toolbar");
  const wordCount = document.querySelector("#editor-word-count");
  const readTime = document.querySelector("#editor-read-time");
  const escape = window.Pollo.escapeHTML;

  try {
    document.execCommand("defaultParagraphSeparator", false, "p");
    document.execCommand("styleWithCSS", false, false);
  } catch (error) {
    void error;
  }

  function sessionIsOpen() {
    try {
      return window.sessionStorage.getItem(SESSION_KEY) === "open";
    } catch (error) {
      return false;
    }
  }

  function setSession(open) {
    try {
      if (open) window.sessionStorage.setItem(SESSION_KEY, "open");
      else window.sessionStorage.removeItem(SESSION_KEY);
    } catch (error) {
      void error;
    }
  }

  function setSaveState(message, isError) {
    saveState.textContent = message;
    saveState.classList.toggle("is-error", Boolean(isError));
  }

  function setCover(value) {
    state.thumbnail = value || "";
    coverPreview.src = state.thumbnail || window.Pollo.defaultThumbnail;
    coverButtonLabel.textContent = state.thumbnail ? "Trocar thumbnail" : "Adicionar thumbnail";
  }

  function updateEmptyState() {
    editorContent.classList.toggle("is-empty", !editorContent.textContent.trim());
  }

  function renderTagEditor() {
    tagChips.innerHTML = state.tags.map((tag) => `<span class="tag-chip">${escape(tag)}<button type="button" data-remove-tag="${escape(tag)}" aria-label="Remover ${escape(tag)}"><i data-lucide="x"></i></button></span>`).join("");

    const suggestions = window.Pollo.getTags().filter((tag) => !state.tags.some((selected) => window.Pollo.tagSlug(selected) === tag.slug));
    tagSuggestions.hidden = !suggestions.length || state.tags.length >= 8;
    tagSuggestions.innerHTML = !tagSuggestions.hidden
      ? `<span class="tag-suggestions-label">Tags usadas</span>${suggestions.map((tag) => `<button class="tag-suggestion" type="button" data-suggest-tag="${escape(tag.name)}">${escape(tag.name)}</button>`).join("")}`
      : "";

    tagInput.disabled = state.tags.length >= 8;
    tagInput.placeholder = state.tags.length >= 8 ? "Máximo de 8 tags" : "Adicionar tag";
    window.PolloUI.refreshIcons();
  }

  function addTagsFromInput() {
    const values = tagInput.value.split(",").map((value) => value.trim()).filter(Boolean);
    if (!values.length) return;

    const previous = state.tags.length;
    state.tags = window.Pollo.normalizeTags([...state.tags, ...values]);
    tagInput.value = "";
    renderTagEditor();
    if (state.tags.length !== previous) markChanged();
  }

  function addTag(value) {
    const previous = state.tags.length;
    state.tags = window.Pollo.normalizeTags([...state.tags, value]);
    renderTagEditor();
    if (state.tags.length !== previous) markChanged();
  }

  function removeTag(value) {
    state.tags = state.tags.filter((tag) => window.Pollo.tagSlug(tag) !== window.Pollo.tagSlug(value));
    renderTagEditor();
    markChanged();
  }

  function inlineMarkdown(node) {
    let output = "";

    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        output += child.nodeValue.replace(/\u00a0/g, " ");
        return;
      }

      if (child.nodeType !== Node.ELEMENT_NODE) return;

      const tag = child.tagName;
      const inner = inlineMarkdown(child);

      if (tag === "STRONG" || tag === "B") output += `**${inner}**`;
      else if (tag === "EM" || tag === "I") output += `*${inner}*`;
      else if (tag === "CODE") output += `\`${child.textContent}\``;
      else if (tag === "A") {
        const href = child.getAttribute("href");
        output += href ? `[${inner}](${href})` : inner;
      } else if (tag === "IMG") {
        const source = child.getAttribute("src");
        if (source) output += `![${child.getAttribute("alt") || ""}](${source})`;
      } else if (tag === "BR") {
        output += "\n";
      } else if (tag === "SPAN") {
        const style = child.getAttribute("style") || "";
        if (/font-weight\s*:\s*(bold|[6-9]00)/i.test(style)) output += `**${inner}**`;
        else if (/font-style\s*:\s*italic/i.test(style)) output += `*${inner}*`;
        else output += inner;
      } else {
        output += inner;
      }
    });

    return output;
  }

  function listMarkdown(element) {
    const ordered = element.tagName === "OL";
    return [...element.children]
      .filter((child) => child.tagName === "LI")
      .map((item, index) => {
        const content = inlineMarkdown(item).trim().replace(/\n+/g, " ");
        if (!content) return "";
        return `${ordered ? `${index + 1}.` : "-"} ${content}`;
      })
      .filter(Boolean)
      .join("\n");
  }

  function blockMarkdown(element) {
    const tag = element.tagName;

    if (tag === "UL" || tag === "OL") return listMarkdown(element);

    if (tag === "BLOCKQUOTE") {
      const parts = [];
      element.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.nodeValue.trim();
          if (text) parts.push(text);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const content = blockMarkdown(node);
          if (content) parts.push(content);
        }
      });
      return parts.join("\n\n").split("\n").filter(Boolean).map((line) => `> ${line}`).join("\n");
    }

    if (tag === "PRE") {
      const code = element.querySelector("code");
      const content = (code ? code.textContent : element.textContent).replace(/\n$/, "");
      return "```\n" + content + "\n```";
    }

    if (/^H[1-4]$/.test(tag)) {
      const level = Number(tag.charAt(1));
      return `${"#".repeat(level)} ${inlineMarkdown(element).trim()}`;
    }

    if (tag === "HR") return "---";

    const blockChildren = [...element.children].filter((child) => /^(P|H[1-4]|UL|OL|BLOCKQUOTE|PRE|HR|DIV)$/.test(child.tagName));
    if (tag === "DIV" && blockChildren.length) {
      return blockChildren.map(blockMarkdown).filter(Boolean).join("\n\n");
    }

    return inlineMarkdown(element).trim();
  }

  function editorMarkdown() {
    const blocks = [];
    editorContent.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue.trim();
        if (text) blocks.push(text);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const content = blockMarkdown(node);
        if (content) blocks.push(content);
      }
    });
    return blocks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function editorWords(markdown) {
    const clean = String(markdown || "").replace(/[#>*_`\-\[\]()]/g, " ").trim();
    return clean ? clean.split(/\s+/).filter(Boolean).length : 0;
  }

  function updateStats() {
    const markdown = editorMarkdown();
    const words = editorWords(markdown);
    wordCount.textContent = `${words} ${words === 1 ? "palavra" : "palavras"}`;
    readTime.textContent = `${window.Pollo.readingMinutes(markdown)} min de leitura`;
    updateEmptyState();
  }

  function currentBlock() {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return null;
    const range = selection.getRangeAt(0);
    let node = range.startContainer;

    if (node === editorContent) {
      const child = editorContent.childNodes[range.startOffset] || editorContent.lastElementChild;
      return child && child.nodeType === Node.ELEMENT_NODE ? child : null;
    }

    while (node && node.parentNode !== editorContent) node = node.parentNode;
    return node && node.nodeType === Node.ELEMENT_NODE ? node : null;
  }

  function placeCaret(element, atStart) {
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(Boolean(atStart));
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function replaceInlineMatch(textNode, start, length, replacement, after) {
    const parent = textNode.parentNode;
    const value = textNode.nodeValue;
    textNode.nodeValue = value.slice(0, start);
    parent.insertBefore(replacement, textNode.nextSibling);
    const tail = document.createTextNode(after || "");
    parent.insertBefore(tail, replacement.nextSibling);

    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(tail, 0);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function autoFormatInline() {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE || !editorContent.contains(node)) return;
    if (node.parentElement && node.parentElement.closest("pre, code")) return;

    const text = node.nodeValue;
    const offset = range.startOffset;
    const before = text.slice(0, offset);
    const after = text.slice(offset);

    const patterns = [
      {
        expression: /\[([^\]]+)\]\(([^)\s]+)\)$/,
        build: (match) => {
          const href = match[2];
          if (!/^(https?:\/\/|mailto:|\/|#|\.\/|\.\.\/)/i.test(href)) return null;
          const link = document.createElement("a");
          link.href = href;
          link.textContent = match[1];
          if (/^https?:\/\//i.test(href)) {
            link.target = "_blank";
            link.rel = "noopener noreferrer";
          }
          return link;
        },
      },
      {
        expression: /\*\*([^*\n]+)\*\*$/,
        build: (match) => {
          const strong = document.createElement("strong");
          strong.textContent = match[1];
          return strong;
        },
      },
      {
        expression: /__([^_\n]+)__$/,
        build: (match) => {
          const strong = document.createElement("strong");
          strong.textContent = match[1];
          return strong;
        },
      },
      {
        expression: /`([^`\n]+)`$/,
        build: (match) => {
          const code = document.createElement("code");
          code.textContent = match[1];
          return code;
        },
      },
      {
        expression: /\*([^*\n]+)\*$/,
        build: (match) => {
          const em = document.createElement("em");
          em.textContent = match[1];
          return em;
        },
      },
      {
        expression: /_([^_\n]+)_$/,
        build: (match) => {
          const em = document.createElement("em");
          em.textContent = match[1];
          return em;
        },
      },
    ];

    for (const pattern of patterns) {
      const match = before.match(pattern.expression);
      if (!match) continue;
      const replacement = pattern.build(match);
      if (!replacement) continue;
      replaceInlineMatch(node, match.index, match[0].length, replacement, after);
      return;
    }
  }

  function convertBlock(block, target) {
    let replacement;
    let focusNode;

    if (target === "ul" || target === "ol") {
      replacement = document.createElement(target);
      const item = document.createElement("li");
      replacement.appendChild(item);
      focusNode = item;
    } else {
      replacement = document.createElement(target);
      replacement.innerHTML = "<br>";
      focusNode = replacement;
    }

    block.replaceWith(replacement);
    editorContent.focus();
    placeCaret(focusNode, true);
    markChanged();
  }

  function insertParagraphAfter(block) {
    const paragraph = document.createElement("p");
    paragraph.innerHTML = "<br>";
    block.insertAdjacentElement("afterend", paragraph);
    editorContent.focus();
    placeCaret(paragraph, true);
    markChanged();
  }

  function formatSelection(format) {
    editorContent.focus();
    const block = currentBlock();

    if (format === "bold" || format === "italic") {
      document.execCommand(format, false);
    } else if (format === "heading") {
      const isHeading = block && /^H[2-3]$/.test(block.tagName);
      document.execCommand("formatBlock", false, isHeading ? "p" : "h2");
    } else if (format === "quote") {
      const isQuote = block && block.closest("blockquote");
      document.execCommand("formatBlock", false, isQuote ? "p" : "blockquote");
    } else if (format === "list") {
      document.execCommand("insertUnorderedList", false);
    }

    markChanged();
  }

  function markChanged() {
    state.dirty = true;
    updateStats();
    setSaveState("Alterações não salvas");
    window.clearTimeout(state.autosaveTimer);
    state.autosaveTimer = window.setTimeout(() => {
      state.autosaveTimer = null;
      persistDraft(false);
    }, 900);
  }

  function collectEditorData() {
    const pendingTags = tagInput.value.split(",").map((value) => value.trim()).filter(Boolean);
    return {
      title: titleField.value.trim(),
      tags: window.Pollo.normalizeTags([...state.tags, ...pendingTags]),
      thumbnail: state.thumbnail,
      body: editorMarkdown(),
    };
  }

  function hasEditorData(data) {
    return Boolean(data.title || data.body || data.thumbnail);
  }

  function persistDraft(announce) {
    window.clearTimeout(state.autosaveTimer);
    state.autosaveTimer = null;
    const data = collectEditorData();

    if (!hasEditorData(data)) {
      if (state.draftId) {
        window.Pollo.deleteDraft(state.draftId);
        state.draftId = null;
      }
      if (announce) setSaveState("Escreva algo primeiro.", true);
      return null;
    }

    try {
      const draft = window.Pollo.saveDraft({
        id: state.draftId,
        postSlug: state.postSlug,
        ...data,
      });
      state.draftId = draft.id;
      state.dirty = false;
      setSaveState("Rascunho salvo");
      return draft;
    } catch (error) {
      setSaveState("Não foi possível salvar o rascunho.", true);
      return null;
    }
  }

  function showAdminFeedback(message, link, isError) {
    adminFeedback.hidden = false;
    adminFeedbackMessage.textContent = message;
    adminFeedback.classList.toggle("is-error", Boolean(isError));
    adminFeedbackMark.innerHTML = `<i data-lucide="${isError ? "alert-circle" : "check"}"></i>`;
    publishedLink.hidden = !link;
    if (link) publishedLink.href = `post.html?slug=${encodeURIComponent(link.slug)}`;
    window.PolloUI.refreshIcons();
  }

  function hideAdminFeedback() {
    adminFeedback.hidden = true;
  }

  function renderAdminLists() {
    const posts = window.Pollo.getPosts();
    const drafts = window.Pollo.getDrafts();

    publishedCount.textContent = String(posts.length);
    draftsCount.textContent = String(drafts.length);

    publishedList.innerHTML = posts.length
      ? posts.map((post) => `<article class="admin-item">
          <img class="admin-item-thumb" src="${escape(post.thumbnail || window.Pollo.defaultThumbnail)}" alt="" loading="lazy">
          <div class="admin-item-copy">
            <h3 class="admin-item-title">${escape(post.title)}</h3>
            <p class="admin-item-meta">${post.tags.map((tag) => `<span>${escape(tag)}</span>`).join("")}<time datetime="${escape(post.date)}">${window.Pollo.formatDate(post.date)}</time></p>
          </div>
          <div class="admin-item-actions">
            <a href="post.html?slug=${encodeURIComponent(post.slug)}">Ver</a>
            <button type="button" data-action="edit" data-slug="${escape(post.slug)}">Editar</button>
            <button type="button" data-action="delete" data-slug="${escape(post.slug)}">Excluir</button>
          </div>
        </article>`).join("")
      : '<p class="admin-empty">Nenhum artigo publicado.</p>';

    draftsList.innerHTML = drafts.length
      ? drafts.map((draft) => `<article class="admin-item">
          <img class="admin-item-thumb" src="${escape(draft.thumbnail || window.Pollo.defaultThumbnail)}" alt="" loading="lazy">
          <div class="admin-item-copy">
            <h3 class="admin-item-title">${escape(draft.title || "Sem título")}</h3>
            <p class="admin-item-meta">${draft.tags.map((tag) => `<span>${escape(tag)}</span>`).join("")}<span>Rascunho</span><span>${escape(window.Pollo.formatCommentDate(draft.updatedAt))}</span></p>
          </div>
          <div class="admin-item-actions">
            <button type="button" data-action="continue" data-draft="${escape(draft.id)}">Continuar</button>
            <button type="button" data-action="delete-draft" data-draft="${escape(draft.id)}">Excluir</button>
          </div>
        </article>`).join("")
      : '<p class="admin-empty">Nenhum rascunho.</p>';

    window.PolloUI.refreshIcons();
  }

  function showDashboard() {
    state.editorOpen = false;
    adminView.classList.remove("is-editing");
    dashboardView.hidden = false;
    editorView.hidden = true;
    hideAdminFeedback();
    document.title = "Artigos — pollo.city";
    renderAdminLists();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function enterEditor(options) {
    state.editorOpen = true;
    state.dirty = false;
    window.clearTimeout(state.autosaveTimer);
    state.autosaveTimer = null;
    hideAdminFeedback();

    const draft = options && options.draft ? options.draft : null;
    const post = options && options.post ? options.post : null;
    const source = draft || post;

    state.draftId = draft ? draft.id : null;
    state.postSlug = draft ? draft.postSlug : post ? post.slug : null;
    state.tags = source ? window.Pollo.normalizeTags(source.tags) : [];

    titleField.value = source ? source.title || "" : "";
    tagInput.value = "";
    renderTagEditor();
    setCover(source ? source.thumbnail || "" : "");
    const markdown = source ? source.body || "" : "";
    editorContent.innerHTML = markdown ? window.PolloMarkdown.render(markdown) : "<p><br></p>";
    updateEmptyState();
    updateStats();
    setSaveState(draft ? "Rascunho carregado" : "");

    adminView.classList.add("is-editing");
    dashboardView.hidden = true;
    editorView.hidden = false;
    document.title = "Editor — pollo.city";
    window.scrollTo({ top: 0, behavior: "auto" });
    window.requestAnimationFrame(() => titleField.focus({ preventScroll: true }));
  }

  function openPostForEditing(slug) {
    const draft = window.Pollo.getDraftForPost(slug);
    if (draft) {
      enterEditor({ draft });
      return;
    }
    const post = window.Pollo.getPost(slug);
    if (post) enterEditor({ post });
  }

  function closeEditor() {
    window.clearTimeout(state.autosaveTimer);
    state.autosaveTimer = null;
    if (state.dirty || state.draftId) persistDraft(false);
    showDashboard();
    document.querySelector("#admin-title").focus({ preventScroll: true });
  }

  function publishArticle() {
    window.clearTimeout(state.autosaveTimer);
    state.autosaveTimer = null;
    const data = collectEditorData();

    if (!data.title) {
      setSaveState("Escreva um título.", true);
      titleField.focus();
      return;
    }

    if (!data.body) {
      setSaveState("Escreva o conteúdo do artigo.", true);
      editorContent.focus();
      return;
    }

    try {
      const post = state.postSlug
        ? window.Pollo.updatePost(state.postSlug, data)
        : window.Pollo.addPost(data);
      if (state.draftId) window.Pollo.deleteDraft(state.draftId);
      state.draftId = null;
      state.postSlug = post.slug;
      state.dirty = false;
      state.editorOpen = false;
      adminView.classList.remove("is-editing");
      editorView.hidden = true;
      dashboardView.hidden = false;
      renderAdminLists();
      showAdminFeedback("Artigo publicado.", post, false);
      document.title = "Artigos — pollo.city";
      window.scrollTo({ top: 0, behavior: "auto" });
      document.querySelector("#admin-title").focus({ preventScroll: true });
    } catch (error) {
      setSaveState("Não foi possível publicar o artigo.", true);
    }
  }

  function optimizeImage(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) {
        reject(new Error("invalid-image"));
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        reject(new Error("image-too-large"));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error("read-error"));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error("image-error"));
        image.onload = () => {
          const maxWidth = 1200;
          const maxHeight = 800;
          const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext("2d");
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        };
        image.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  function showAuth() {
    authView.hidden = false;
    adminView.hidden = true;
    adminView.classList.remove("is-editing");
    state.editorOpen = false;
    document.title = "Admin — pollo.city";
    loginError.hidden = true;
    passwordField.value = "";
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function showAdmin() {
    authView.hidden = true;
    adminView.hidden = false;
    adminView.classList.remove("is-editing");
    dashboardView.hidden = false;
    editorView.hidden = true;
    hideAdminFeedback();
    document.title = "Artigos — pollo.city";
    renderAdminLists();
    document.querySelector("#admin-title").focus({ preventScroll: true });
    window.PolloUI.refreshIcons();
  }

  function attemptLogin(password) {
    if (password !== ADMIN_PASSWORD) {
      loginError.hidden = false;
      passwordField.setAttribute("aria-invalid", "true");
      passwordField.focus();
      passwordField.select();
      return;
    }

    loginError.hidden = true;
    passwordField.removeAttribute("aria-invalid");
    setSession(true);
    showAdmin();
  }

  passwordToggle.addEventListener("click", () => {
    const isPassword = passwordField.type === "password";
    passwordField.type = isPassword ? "text" : "password";
    passwordToggle.setAttribute("aria-pressed", String(isPassword));
    passwordToggle.setAttribute("aria-label", isPassword ? "Ocultar senha" : "Mostrar senha");
    passwordToggle.innerHTML = isPassword ? '<i data-lucide="eye-off"></i>' : '<i data-lucide="eye"></i>';
    window.PolloUI.refreshIcons();
    passwordField.focus();
  });

  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    attemptLogin(passwordField.value);
  });

  passwordField.addEventListener("input", () => {
    loginError.hidden = true;
    passwordField.removeAttribute("aria-invalid");
  });

  logoutButton.addEventListener("click", () => {
    setSession(false);
    showAuth();
  });

  newArticleButton.addEventListener("click", () => {
    enterEditor({});
  });

  editorBack.addEventListener("click", closeEditor);
  saveDraftButton.addEventListener("click", () => persistDraft(true));
  publishButton.addEventListener("click", publishArticle);

  titleField.addEventListener("input", markChanged);

  tagInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTagsFromInput();
    } else if (event.key === "Backspace" && !tagInput.value && state.tags.length) {
      removeTag(state.tags[state.tags.length - 1]);
    } else if (event.key === "Escape") {
      tagInput.value = "";
    }
  });

  tagInput.addEventListener("blur", addTagsFromInput);

  tagChips.addEventListener("mousedown", (event) => {
    if (event.target.closest("[data-remove-tag]")) event.preventDefault();
  });

  tagChips.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-tag]");
    if (button) removeTag(button.dataset.removeTag);
  });

  tagSuggestions.addEventListener("mousedown", (event) => {
    if (event.target.closest("[data-suggest-tag]")) event.preventDefault();
  });

  tagSuggestions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-suggest-tag]");
    if (!button) return;
    addTag(button.dataset.suggestTag);
    tagInput.focus();
  });

  editorContent.addEventListener("input", (event) => {
    if (event.isComposing) return;
    autoFormatInline();
    markChanged();
  });

  editorContent.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      const key = event.key.toLowerCase();
      if (key === "b" || key === "i") {
        event.preventDefault();
        document.execCommand(key === "b" ? "bold" : "italic", false);
        markChanged();
        return;
      }
    }

    if (event.key === " " && !event.shiftKey) {
      const block = currentBlock();
      if (!block || !["P", "DIV"].includes(block.tagName)) return;
      const marker = block.textContent.trim();
      const targets = { "#": "h2", "##": "h3", ">": "blockquote", "-": "ul", "*": "ul", "1.": "ol" };
      const target = targets[marker];
      if (!target) return;
      event.preventDefault();
      convertBlock(block, target);
      return;
    }

    if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      const block = currentBlock();
      if (block && /^H[2-3]$/.test(block.tagName)) {
        event.preventDefault();
        insertParagraphAfter(block);
      }
    }
  });

  editorContent.addEventListener("paste", (event) => {
    event.preventDefault();
    const text = (event.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertText", false, text);
  });

  toolbar.addEventListener("mousedown", (event) => {
    if (event.target.closest("[data-format]")) event.preventDefault();
  });

  toolbar.addEventListener("click", (event) => {
    const button = event.target.closest("[data-format]");
    if (!button) return;
    formatSelection(button.dataset.format);
  });

  coverButton.addEventListener("click", () => coverInput.click());

  coverInput.addEventListener("change", async () => {
    const file = coverInput.files && coverInput.files[0];
    coverInput.value = "";
    if (!file) return;
    setSaveState("Preparando imagem");
    try {
      const dataUrl = await optimizeImage(file);
      setCover(dataUrl);
      markChanged();
    } catch (error) {
      setSaveState("Não foi possível carregar a imagem.", true);
    }
  });

  coverPreview.addEventListener("error", () => {
    if (coverPreview.src.endsWith(window.Pollo.defaultThumbnail)) return;
    setCover("");
  });

  publishedList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const slug = button.dataset.slug;
    if (button.dataset.action === "edit") {
      openPostForEditing(slug);
      return;
    }

    if (button.dataset.action === "delete") {
      const post = window.Pollo.getPost(slug);
      if (!post) return;
      if (!window.confirm(`Excluir "${post.title}"?`)) return;
      try {
        window.Pollo.deletePost(slug);
        renderAdminLists();
      } catch (error) {
        showAdminFeedback("Não foi possível excluir o artigo.", null, true);
      }
    }
  });

  draftsList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const draftId = button.dataset.draft;
    if (button.dataset.action === "continue") {
      const draft = window.Pollo.getDraft(draftId);
      if (draft) enterEditor({ draft });
      return;
    }

    if (button.dataset.action === "delete-draft") {
      if (!window.confirm("Excluir este rascunho?")) return;
      window.Pollo.deleteDraft(draftId);
      renderAdminLists();
    }
  });

  exportButton.addEventListener("click", () => {
    try {
      const backup = window.Pollo.exportData();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const date = new Date();
      link.href = url;
      link.download = `pollo-city-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      showAdminFeedback("Não foi possível exportar os dados.", null, true);
    }
  });

  importButton.addEventListener("click", () => importInput.click());

  importInput.addEventListener("change", async () => {
    const file = importInput.files && importInput.files[0];
    importInput.value = "";
    if (!file) return;

    try {
      const payload = JSON.parse(await file.text());
      if (!window.confirm("Substituir os dados atuais pelos do arquivo?")) return;
      window.Pollo.importData(payload);
      window.location.reload();
    } catch (error) {
      showAdminFeedback("Não foi possível importar os dados.", null, true);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!state.editorOpen || !(event.ctrlKey || event.metaKey)) return;
    if (event.key.toLowerCase() === "s") {
      event.preventDefault();
      persistDraft(true);
    }
    if (event.key === "Enter") {
      event.preventDefault();
      publishArticle();
    }
  });

  window.addEventListener("beforeunload", () => {
    if (!state.editorOpen) return;
    const data = collectEditorData();
    try {
      if (!hasEditorData(data)) {
        if (state.draftId) window.Pollo.deleteDraft(state.draftId);
        return;
      }
      window.Pollo.saveDraft({
        id: state.draftId,
        postSlug: state.postSlug,
        ...data,
      });
    } catch (error) {
      void error;
    }
  });

  window.PolloUI.refreshIcons();

  if (sessionIsOpen()) showAdmin();
  else showAuth();
})();
