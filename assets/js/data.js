(function () {
  const API_BASE = "/api";
  const DEFAULT_THUMBNAIL = "assets/img/thumb-default.svg";
  const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  let postsCache = null;
  let tagsCache = null;

  class APIError extends Error {
    constructor(message, status) {
      super(message);
      this.name = "APIError";
      this.status = status;
    }
  }

  async function request(path, options = {}) {
    const headers = { Accept: "application/json" };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";

    let response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        method: options.method || "GET",
        headers,
        credentials: "same-origin",
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch (error) {
      throw new APIError("Não foi possível conectar ao servidor.", 0);
    }

    if (response.status === 204) return null;

    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }

    if (!response.ok) {
      throw new APIError(payload && payload.error ? payload.error : "Não foi possível concluir a operação.", response.status);
    }
    return payload;
  }

  function invalidateCache() {
    postsCache = null;
    tagsCache = null;
  }

  async function getPosts(force = false) {
    if (!force && postsCache) return postsCache;
    const payload = await request("/posts");
    postsCache = Array.isArray(payload.posts) ? payload.posts : [];
    return postsCache;
  }

  async function getPost(slug) {
    const posts = await getPosts();
    return posts.find((post) => post.slug === slug) || null;
  }

  async function getTags(force = false) {
    if (!force && tagsCache) return tagsCache;
    const payload = await request("/tags");
    tagsCache = Array.isArray(payload.tags) ? payload.tags : [];
    return tagsCache;
  }

  async function getComments(slug) {
    const payload = await request(`/posts/${encodeURIComponent(slug)}/comments`);
    return Array.isArray(payload.comments) ? payload.comments : [];
  }

  async function addComment(slug, data) {
    const payload = await request(`/posts/${encodeURIComponent(slug)}/comments`, {
      method: "POST",
      body: { name: data.name, body: data.body },
    });
    return payload.comment;
  }

  async function login(password) {
    await request("/admin/login", { method: "POST", body: { password } });
    invalidateCache();
  }

  async function logout() {
    await request("/admin/logout", { method: "POST" });
    invalidateCache();
  }

  async function session() {
    const payload = await request("/admin/session");
    return Boolean(payload.authenticated);
  }

  async function addPost(data) {
    const payload = await request("/admin/posts", { method: "POST", body: data });
    invalidateCache();
    return payload.post;
  }

  async function updatePost(slug, data) {
    const payload = await request(`/admin/posts/${encodeURIComponent(slug)}`, { method: "PUT", body: data });
    invalidateCache();
    return payload.post;
  }

  async function deletePost(slug) {
    await request(`/admin/posts/${encodeURIComponent(slug)}`, { method: "DELETE" });
    invalidateCache();
  }

  async function getDrafts() {
    const payload = await request("/admin/drafts");
    return Array.isArray(payload.drafts) ? payload.drafts : [];
  }

  async function getDraft(id) {
    const drafts = await getDrafts();
    return drafts.find((draft) => draft.id === id) || null;
  }

  async function getDraftForPost(slug) {
    const drafts = await getDrafts();
    return drafts.find((draft) => draft.postSlug === slug) || null;
  }

  async function createDraft(data) {
    const payload = await request("/admin/drafts", { method: "POST", body: data });
    return payload.draft;
  }

  async function updateDraft(id, data) {
    const payload = await request(`/admin/drafts/${encodeURIComponent(id)}`, { method: "PUT", body: data });
    return payload.draft;
  }

  async function deleteDraft(id) {
    await request(`/admin/drafts/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async function uploadImage(file) {
    const form = new FormData();
    form.append("file", file);
    let response;
    try {
      response = await fetch(`${API_BASE}/admin/uploads`, {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });
    } catch (error) {
      throw new APIError("Não foi possível enviar a imagem.", 0);
    }
    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }
    if (!response.ok) {
      throw new APIError(payload && payload.error ? payload.error : "Não foi possível enviar a imagem.", response.status);
    }
    return payload.url;
  }

  async function exportData() {
    return request("/admin/export");
  }

  async function importData(data) {
    await request("/admin/import", { method: "POST", body: data });
    invalidateCache();
  }

  function parseDate(value) {
    if (!value) return new Date();
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
      const parts = String(value).split("-").map(Number);
      return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  function formatDate(value) {
    const date = parseDate(value);
    return `${String(date.getDate()).padStart(2, "0")} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  }

  function formatCommentDate(value) {
    const date = parseDate(value);
    const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    return `${String(date.getDate()).padStart(2, "0")} ${MONTHS[date.getMonth()]} ${date.getFullYear()} · ${time}`;
  }

  function normalizeTag(value) {
    return String(value || "")
      .trim()
      .replace(/^#+/, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 24);
  }

  function tagSlug(value) {
    return normalizeTag(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function normalizeTags(values) {
    const source = Array.isArray(values) ? values : values ? [values] : [];
    const seen = new Set();
    const tags = [];
    source.forEach((value) => {
      const tag = normalizeTag(value);
      const slug = tagSlug(tag);
      if (!tag || !slug || seen.has(slug) || tags.length >= 8) return;
      seen.add(slug);
      tags.push(tag);
    });
    return tags;
  }

  function readingMinutes(body) {
    const words = String(body || "").replace(/[#>*_`\-\[\]()]/g, " ").trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 210));
  }

  function initials(name) {
    const pieces = String(name || "?").trim().split(/\s+/).filter(Boolean);
    if (!pieces.length) return "?";
    if (pieces.length === 1) return pieces[0].slice(0, 2).toUpperCase();
    return `${pieces[0][0]}${pieces[pieces.length - 1][0]}`.toUpperCase();
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[character]));
  }

  window.Pollo = {
    APIError,
    getPosts,
    getPost,
    getTags,
    getComments,
    addComment,
    login,
    logout,
    session,
    addPost,
    updatePost,
    deletePost,
    getDrafts,
    getDraft,
    getDraftForPost,
    createDraft,
    updateDraft,
    deleteDraft,
    uploadImage,
    exportData,
    importData,
    formatDate,
    formatCommentDate,
    normalizeTags,
    tagSlug,
    readingMinutes,
    initials,
    escapeHTML,
    defaultThumbnail: DEFAULT_THUMBNAIL,
  };
})();
