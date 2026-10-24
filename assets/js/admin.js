(function () {
  const state = {
    draftId: null,
    postSlug: null,
    thumbnail: "",
    tags: [],
    availableTags: [],
    editorOpen: false,
    editorInstance: null,
    syncingEditor: false,
    dirty: false,
    revision: 0,
    publishing: false,
    autosaveTimer: null,
    saveChain: Promise.resolve(),
    aboutEditorInstance: null,
    syncingAboutEditor: false,
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
  const editAboutButton = document.querySelector("#edit-about-button");
  const exportButton = document.querySelector("#export-button");
  const importButton = document.querySelector("#import-button");
  const importInput = document.querySelector("#import-input");
  const editorBack = document.querySelector("#editor-back");
  const saveDraftButton = document.querySelector("#save-draft-button");
  const publishButton = document.querySelector("#publish-button");
  const saveState = document.querySelector("#editor-save-state");
  const titleField = document.querySelector("#editor-title");
  const excerptField = document.querySelector("#editor-excerpt");
  const tagChips = document.querySelector("#editor-tag-chips");
  const tagInput = document.querySelector("#tag-input");
  const tagSuggestions = document.querySelector("#tag-suggestions");
  const coverPreview = document.querySelector("#cover-preview");
  const coverButton = document.querySelector("#cover-button");
  const coverButtonLabel = document.querySelector("#cover-button-label");
  const coverInput = document.querySelector("#cover-input");
  const markdownEditorHost = document.querySelector("#markdown-editor");
  const wordCount = document.querySelector("#editor-word-count");
  const readTime = document.querySelector("#editor-read-time");
  const aboutView = document.querySelector("#about-view");
  const aboutBack = document.querySelector("#about-back");
  const saveAboutButton = document.querySelector("#save-about-button");
  const aboutSaveState = document.querySelector("#about-save-state");
  const aboutTitle = document.querySelector("#about-title");
  const aboutLede = document.querySelector("#about-lede");
  const aboutEditorHost = document.querySelector("#about-editor");
  const aboutWordCount = document.querySelector("#about-word-count");
  const aboutReadTime = document.querySelector("#about-read-time");
  const escape = window.Pollo.escapeHTML;

  function setSaveState(message, isError) {
    saveState.textContent = message;
    saveState.classList.toggle("is-error", Boolean(isError));
  }

  function setCover(value) {
    state.thumbnail = value || "";
    coverPreview.src = state.thumbnail || window.Pollo.defaultThumbnail;
    coverButtonLabel.textContent = state.thumbnail ? "Trocar thumbnail" : "Adicionar thumbnail";
  }

  function renderTagEditor() {
    tagChips.innerHTML = state.tags.map((tag) => `<span class="tag-chip">${escape(tag)}<button type="button" data-remove-tag="${escape(tag)}" aria-label="Remover ${escape(tag)}"><i data-lucide="x"></i></button></span>`).join("");

    const suggestions = state.availableTags.filter((tag) => !state.tags.some((selected) => window.Pollo.tagSlug(selected) === tag.slug));
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

  function editorMarkdown() {
    return state.editorInstance ? state.editorInstance.getMarkdown().trim() : "";
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
  }

  function ensureMarkdownEditor() {
    if (state.editorInstance) return true;
    if (!window.toastui || !window.toastui.Editor) {
      setSaveState("Não foi possível carregar o editor.", true);
      return false;
    }

    const codeSyntaxHighlight = window.toastui.Editor.plugin ? window.toastui.Editor.plugin.codeSyntaxHighlight : null;

    try {
      state.editorInstance = new window.toastui.Editor({
        el: markdownEditorHost,
        height: "auto",
        minHeight: "560px",
        initialEditType: "wysiwyg",
        previewStyle: "tab",
        hideModeSwitch: true,
        usageStatistics: false,
        autofocus: false,
        language: "pt-BR",
        placeholder: "Escreva seu artigo",
        toolbarItems: [
          ["heading", "bold", "italic", "strike"],
          ["hr", "quote"],
          ["ul", "ol", "task", "indent", "outdent"],
          ["table", "image", "link"],
          ["code", "codeblock"],
        ],
        plugins: codeSyntaxHighlight ? [codeSyntaxHighlight] : [],
        hooks: {
          addImageBlobHook: async (blob, callback) => {
            try {
              const url = await window.Pollo.uploadImage(blob);
              callback(url, blob.name || "imagem");
              markChanged();
            } catch (error) {
              setSaveState("Não foi possível carregar a imagem.", true);
            }
          },
        },
        events: {
          change: () => {
            if (state.syncingEditor) return;
            updateStats();
            markChanged();
          },
        },
      });
      return true;
    } catch (error) {
      setSaveState("Não foi possível carregar o editor.", true);
      return false;
    }
  }

  function markChanged() {
    state.dirty = true;
    state.revision += 1;
    updateStats();
    setSaveState("Alterações não salvas");
    window.clearTimeout(state.autosaveTimer);
    state.autosaveTimer = window.setTimeout(() => {
      state.autosaveTimer = null;
      void persistDraft(false);
    }, 900);
  }

  function setAboutSaveState(message, isError) {
    aboutSaveState.textContent = message;
    aboutSaveState.classList.toggle("is-error", Boolean(isError));
  }

  function aboutEditorMarkdown() {
    return state.aboutEditorInstance ? state.aboutEditorInstance.getMarkdown().trim() : "";
  }

  function updateAboutStats() {
    const markdown = aboutEditorMarkdown();
    const words = editorWords(markdown);
    aboutWordCount.textContent = `${words} ${words === 1 ? "palavra" : "palavras"}`;
    aboutReadTime.textContent = `${window.Pollo.readingMinutes(markdown)} min de leitura`;
  }

  function ensureAboutEditor() {
    if (state.aboutEditorInstance) return true;
    if (!window.toastui || !window.toastui.Editor) {
      setAboutSaveState("Não foi possível carregar o editor.", true);
      return false;
    }

    const codeSyntaxHighlight = window.toastui.Editor.plugin ? window.toastui.Editor.plugin.codeSyntaxHighlight : null;

    try {
      state.aboutEditorInstance = new window.toastui.Editor({
        el: aboutEditorHost,
        height: "auto",
        minHeight: "460px",
        initialEditType: "wysiwyg",
        previewStyle: "tab",
        hideModeSwitch: true,
        usageStatistics: false,
        autofocus: false,
        language: "pt-BR",
        placeholder: "Escreva o conteúdo da página Sobre",
        toolbarItems: [
          ["heading", "bold", "italic", "strike"],
          ["hr", "quote"],
          ["ul", "ol", "task", "indent", "outdent"],
          ["table", "image", "link"],
          ["code", "codeblock"],
        ],
        plugins: codeSyntaxHighlight ? [codeSyntaxHighlight] : [],
        hooks: {
          addImageBlobHook: async (blob, callback) => {
            try {
              const url = await window.Pollo.uploadImage(blob);
              callback(url, blob.name || "imagem");
              setAboutSaveState("Alterações não salvas");
            } catch (error) {
              setAboutSaveState("Não foi possível carregar a imagem.", true);
            }
          },
        },
        events: {
          change: () => {
            if (state.syncingAboutEditor) return;
            updateAboutStats();
            setAboutSaveState("Alterações não salvas");
          },
        },
      });
      return true;
    } catch (error) {
      setAboutSaveState("Não foi possível carregar o editor.", true);
      return false;
    }
  }

  async function openAboutEditor() {
    hideAdminFeedback();
    try {
      const about = await window.Pollo.getAbout(true);
      aboutTitle.value = about.title || "Sobre";
      aboutLede.value = about.lede || "";

      adminView.classList.add("is-editing");
      dashboardView.hidden = true;
      editorView.hidden = true;
      aboutView.hidden = false;
      document.title = "Sobre — Admin — pollo.city";

      state.syncingAboutEditor = true;
      if (ensureAboutEditor()) {
        state.aboutEditorInstance.setMarkdown(about.body || "", false);
        updateAboutStats();
        window.setTimeout(() => {
          state.syncingAboutEditor = false;
          updateAboutStats();
        }, 100);
        setAboutSaveState(about.updatedAt ? `Atualizado em ${window.Pollo.formatCommentDate(about.updatedAt)}` : "Conteúdo padrão");
      } else {
        state.syncingAboutEditor = false;
        setAboutSaveState("Não foi possível carregar o editor.", true);
      }

      window.scrollTo({ top: 0, behavior: "auto" });
      window.requestAnimationFrame(() => aboutTitle.focus({ preventScroll: true }));
      window.PolloUI.refreshIcons();
    } catch (error) {
      showAdminFeedback("Não foi possível abrir a página Sobre.", null, true);
    }
  }

  async function saveAbout() {
    const title = aboutTitle.value.trim();
    const lede = aboutLede.value.trim();
    if (!title) {
      setAboutSaveState("Escreva um título.", true);
      aboutTitle.focus();
      return;
    }

    saveAboutButton.disabled = true;
    setAboutSaveState("Salvando…");
    try {
      const about = await window.Pollo.updateAbout({
        title,
        lede,
        body: aboutEditorMarkdown(),
      });
      aboutTitle.value = about.title;
      aboutLede.value = about.lede;
      setAboutSaveState("Sobre salvo");
    } catch (error) {
      setAboutSaveState("Não foi possível salvar a página Sobre.", true);
    } finally {
      saveAboutButton.disabled = false;
    }
  }

  async function closeAboutEditor() {
    aboutView.hidden = true;
    await showDashboard();
    document.querySelector("#admin-title").focus({ preventScroll: true });
  }

  function collectEditorData() {
    const pendingTags = tagInput.value.split(",").map((value) => value.trim()).filter(Boolean);
    return {
      title: titleField.value.trim(),
      excerpt: excerptField.value.trim(),
      tags: window.Pollo.normalizeTags([...state.tags, ...pendingTags]),
      thumbnail: state.thumbnail,
      body: editorMarkdown(),
    };
  }

  function hasEditorData(data) {
    return Boolean(data.title || data.excerpt || data.body || data.thumbnail);
  }

  async function persistDraft(announce) {
    window.clearTimeout(state.autosaveTimer);
    state.autosaveTimer = null;
    const data = collectEditorData();
    const revision = state.revision;

    if (!hasEditorData(data)) {
      state.saveChain = state.saveChain
        .then(async () => {
          if (!state.draftId) return;
          const draftID = state.draftId;
          state.draftId = null;
          await window.Pollo.deleteDraft(draftID);
        })
        .catch(() => null);
      await state.saveChain;
      if (announce) setSaveState("Escreva algo primeiro.", true);
      return null;
    }

    state.saveChain = state.saveChain
      .then(async () => {
        const draftData = { ...data, postSlug: state.postSlug || "" };
        const draft = state.draftId
          ? await window.Pollo.updateDraft(state.draftId, draftData)
          : await window.Pollo.createDraft(draftData);
        state.draftId = draft.id;
        if (state.revision === revision) {
          state.dirty = false;
          setSaveState("Rascunho salvo");
        }
        return draft;
      })
      .catch((error) => {
        setSaveState("Não foi possível salvar o rascunho.", true);
        return null;
      });

    return state.saveChain;
  }

  function showAdminFeedback(message, link, isError) {
    adminFeedback.hidden = false;
    adminFeedbackMessage.textContent = message;
    adminFeedback.classList.toggle("is-error", Boolean(isError));
    adminFeedbackMark.innerHTML = `<i data-lucide="${isError ? "alert-circle" : "check"}"></i>`;
    publishedLink.hidden = !link;
    if (link) publishedLink.href = `/post/${encodeURIComponent(link.slug)}`;
    window.PolloUI.refreshIcons();
  }

  function hideAdminFeedback() {
    adminFeedback.hidden = true;
  }

  async function renderAdminLists() {
    try {
      const [posts, drafts, tags] = await Promise.all([
        window.Pollo.getPosts(),
        window.Pollo.getDrafts(),
        window.Pollo.getTags(),
      ]);
      state.availableTags = tags;

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
              <a href="/post/${encodeURIComponent(post.slug)}">Ver</a>
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
    } catch (error) {
      publishedCount.textContent = "0";
      draftsCount.textContent = "0";
      publishedList.innerHTML = '<p class="admin-empty">Não foi possível carregar os artigos.</p>';
      draftsList.innerHTML = '<p class="admin-empty">Não foi possível carregar os rascunhos.</p>';
    }

    window.PolloUI.refreshIcons();
  }

  async function showDashboard() {
    state.editorOpen = false;
    adminView.classList.remove("is-editing");
    dashboardView.hidden = false;
    editorView.hidden = true;
    aboutView.hidden = true;
    hideAdminFeedback();
    document.title = "Artigos — pollo.city";
    await renderAdminLists();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function enterEditor(options) {
    state.editorOpen = true;
    state.dirty = false;
    state.revision = 0;
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
    excerptField.value = source ? source.excerpt || "" : "";
    tagInput.value = "";
    renderTagEditor();
    setCover(source ? source.thumbnail || "" : "");
    const markdown = source ? source.body || "" : "";

    adminView.classList.add("is-editing");
    dashboardView.hidden = true;
    editorView.hidden = false;
    aboutView.hidden = true;
    document.title = "Editor — pollo.city";

    state.syncingEditor = true;
    if (ensureMarkdownEditor()) {
      state.editorInstance.setMarkdown(markdown, false);
      updateStats();
      window.setTimeout(() => {
        state.syncingEditor = false;
        updateStats();
      }, 100);
    } else {
      state.syncingEditor = false;
    }

    state.dirty = false;
    setSaveState(draft ? "Rascunho carregado" : "");
    window.scrollTo({ top: 0, behavior: "auto" });
    window.requestAnimationFrame(() => titleField.focus({ preventScroll: true }));
  }

  async function openPostForEditing(slug) {
    try {
      const draft = await window.Pollo.getDraftForPost(slug);
      if (draft) {
        enterEditor({ draft });
        return;
      }
      const post = await window.Pollo.getPost(slug);
      if (post) enterEditor({ post });
    } catch (error) {
      showAdminFeedback("Não foi possível abrir o artigo.", null, true);
    }
  }

  async function closeEditor() {
    window.clearTimeout(state.autosaveTimer);
    state.autosaveTimer = null;
    if (state.dirty || state.draftId) await persistDraft(false);
    await showDashboard();
    document.querySelector("#admin-title").focus({ preventScroll: true });
  }

  async function publishArticle() {
    if (state.publishing) return;
    window.clearTimeout(state.autosaveTimer);
    state.autosaveTimer = null;
    state.publishing = true;
    publishButton.disabled = true;

    try {
      await state.saveChain;
      const data = collectEditorData();

      if (!data.title) {
        setSaveState("Escreva um título.", true);
        titleField.focus();
        return;
      }

      if (!data.body) {
        setSaveState("Escreva o conteúdo do artigo.", true);
        if (state.editorInstance) state.editorInstance.focus();
        return;
      }

      const post = state.postSlug
        ? await window.Pollo.updatePost(state.postSlug, data)
        : await window.Pollo.addPost(data);

      if (state.draftId) {
        const draftID = state.draftId;
        state.draftId = null;
        try {
          await window.Pollo.deleteDraft(draftID);
        } catch (error) {
          void error;
        }
      }

      state.postSlug = post.slug;
      state.dirty = false;
      state.editorOpen = false;
      adminView.classList.remove("is-editing");
      editorView.hidden = true;
      aboutView.hidden = true;
      dashboardView.hidden = false;
      await renderAdminLists();
      showAdminFeedback("Artigo publicado.", post, false);
      document.title = "Artigos — pollo.city";
      window.scrollTo({ top: 0, behavior: "auto" });
      document.querySelector("#admin-title").focus({ preventScroll: true });
    } catch (error) {
      setSaveState("Não foi possível publicar o artigo.", true);
    } finally {
      state.publishing = false;
      publishButton.disabled = false;
    }
  }

  function showAuth() {
    authView.hidden = false;
    adminView.hidden = true;
    adminView.classList.remove("is-editing");
    editorView.hidden = true;
    aboutView.hidden = true;
    state.editorOpen = false;
    state.dirty = false;
    window.clearTimeout(state.autosaveTimer);
    state.autosaveTimer = null;
    document.title = "Admin — pollo.city";
    loginError.hidden = true;
    passwordField.value = "";
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  async function showAdmin() {
    authView.hidden = true;
    adminView.hidden = false;
    adminView.classList.remove("is-editing");
    dashboardView.hidden = false;
    editorView.hidden = true;
    aboutView.hidden = true;
    hideAdminFeedback();
    document.title = "Artigos — pollo.city";
    await renderAdminLists();
    document.querySelector("#admin-title").focus({ preventScroll: true });
    window.PolloUI.refreshIcons();
  }

  async function attemptLogin(password) {
    loginError.hidden = true;
    passwordField.removeAttribute("aria-invalid");
    try {
      await window.Pollo.login(password);
      await showAdmin();
    } catch (error) {
      loginError.textContent = error.status === 401 ? "Senha incorreta. Tente de novo." : "Não foi possível entrar agora.";
      loginError.hidden = false;
      passwordField.setAttribute("aria-invalid", "true");
      passwordField.focus();
      passwordField.select();
    }
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

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await attemptLogin(passwordField.value);
  });

  passwordField.addEventListener("input", () => {
    loginError.hidden = true;
    passwordField.removeAttribute("aria-invalid");
  });

  logoutButton.addEventListener("click", async () => {
    try {
      await window.Pollo.logout();
    } catch (error) {
      void error;
    }
    showAuth();
  });

  newArticleButton.addEventListener("click", () => {
    enterEditor({});
  });

  editAboutButton.addEventListener("click", openAboutEditor);
  aboutBack.addEventListener("click", closeAboutEditor);
  saveAboutButton.addEventListener("click", saveAbout);
  aboutTitle.addEventListener("input", () => setAboutSaveState("Alterações não salvas"));
  aboutLede.addEventListener("input", () => setAboutSaveState("Alterações não salvas"));

  editorBack.addEventListener("click", closeEditor);
  saveDraftButton.addEventListener("click", async () => {
    await persistDraft(true);
  });
  publishButton.addEventListener("click", publishArticle);

  titleField.addEventListener("input", markChanged);
  excerptField.addEventListener("input", markChanged);

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

  coverButton.addEventListener("click", () => coverInput.click());

  coverInput.addEventListener("change", async () => {
    const file = coverInput.files && coverInput.files[0];
    coverInput.value = "";
    if (!file) return;
    setSaveState("Enviando imagem");
    try {
      const url = await window.Pollo.uploadImage(file);
      setCover(url);
      markChanged();
    } catch (error) {
      setSaveState("Não foi possível carregar a imagem.", true);
    }
  });

  coverPreview.addEventListener("error", () => {
    if (coverPreview.src.endsWith(window.Pollo.defaultThumbnail)) return;
    setCover("");
  });

  publishedList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const slug = button.dataset.slug;
    if (button.dataset.action === "edit") {
      await openPostForEditing(slug);
      return;
    }

    if (button.dataset.action === "delete") {
      try {
        const post = await window.Pollo.getPost(slug);
        if (!post) return;
        if (!window.confirm(`Excluir "${post.title}"?`)) return;
        await window.Pollo.deletePost(slug);
        await renderAdminLists();
      } catch (error) {
        showAdminFeedback("Não foi possível excluir o artigo.", null, true);
      }
    }
  });

  draftsList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const draftId = button.dataset.draft;
    if (button.dataset.action === "continue") {
      try {
        const draft = await window.Pollo.getDraft(draftId);
        if (draft) enterEditor({ draft });
      } catch (error) {
        showAdminFeedback("Não foi possível abrir o rascunho.", null, true);
      }
      return;
    }

    if (button.dataset.action === "delete-draft") {
      if (!window.confirm("Excluir este rascunho?")) return;
      try {
        await window.Pollo.deleteDraft(draftId);
        await renderAdminLists();
      } catch (error) {
        showAdminFeedback("Não foi possível excluir o rascunho.", null, true);
      }
    }
  });

  exportButton.addEventListener("click", async () => {
    try {
      const backup = await window.Pollo.exportData();
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
      await window.Pollo.importData(payload);
      window.location.reload();
    } catch (error) {
      showAdminFeedback("Não foi possível importar os dados.", null, true);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    if (!aboutView.hidden && event.key.toLowerCase() === "s") {
      event.preventDefault();
      event.stopPropagation();
      void saveAbout();
      return;
    }
    if (!state.editorOpen) return;
    if (event.key.toLowerCase() === "s") {
      event.preventDefault();
      event.stopPropagation();
      void persistDraft(true);
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      void publishArticle();
    }
  }, true);

  window.addEventListener("beforeunload", (event) => {
    if (!state.editorOpen || !state.dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });

  (async function init() {
    window.PolloUI.refreshIcons();
    try {
      if (await window.Pollo.session()) await showAdmin();
      else showAuth();
    } catch (error) {
      showAuth();
    }
  })();
})();
