(function () {
  const ADMIN_PASSWORD = "pollo2026";
  const SESSION_KEY = "pollo.admin.session.v1";
  const authView = document.querySelector("#auth-view");
  const adminView = document.querySelector("#admin-view");
  const loginForm = document.querySelector("#login-form");
  const passwordField = document.querySelector("#admin-password");
  const passwordToggle = document.querySelector("#password-toggle");
  const loginError = document.querySelector("#login-error");
  const logoutButton = document.querySelector("#logout-button");
  const postForm = document.querySelector("#post-form");
  const titleField = document.querySelector("#post-title");
  const categoryField = document.querySelector("#post-category");
  const thumbnailField = document.querySelector("#post-thumbnail");
  const excerptField = document.querySelector("#post-excerpt");
  const bodyField = document.querySelector("#post-body");
  const feedback = document.querySelector("#publish-feedback");
  const feedbackMark = feedback.querySelector(".feedback-mark");
  const feedbackMessage = feedback.querySelector(".feedback-message");
  const publishedLink = document.querySelector("#published-link");

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
      return;
    }
  }

  function showAuth() {
    authView.hidden = false;
    adminView.hidden = true;
    document.title = "Admin — pollo.city";
    loginError.hidden = true;
    passwordField.value = "";
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function showAdmin() {
    authView.hidden = true;
    adminView.hidden = false;
    document.title = "Novo artigo — pollo.city";
    window.PolloUI.refreshIcons();
    document.querySelector("#admin-title").focus({ preventScroll: true });
  }

  function attemptLogin(password) {
    if (password !== ADMIN_PASSWORD) {
      loginError.hidden = false;
      passwordField.setAttribute("aria-invalid", "true");
      passwordField.focus();
      passwordField.select();
      return false;
    }

    loginError.hidden = true;
    passwordField.removeAttribute("aria-invalid");
    setSession(true);
    showAdmin();
    return true;
  }

  function showFeedback(message, isError, post) {
    feedback.hidden = false;
    feedbackMessage.textContent = message;
    feedback.classList.toggle("is-error", Boolean(isError));
    feedbackMark.innerHTML = `<i data-lucide="${isError ? "alert-circle" : "check"}"></i>`;
    publishedLink.hidden = !post;
    if (post) publishedLink.href = `post.html?slug=${encodeURIComponent(post.slug)}`;
    window.PolloUI.refreshIcons();
    feedback.scrollIntoView({ behavior: "smooth", block: "center" });
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

  postForm.addEventListener("input", () => {
    feedback.hidden = true;
  });

  postForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!titleField.value.trim() || !bodyField.value.trim()) return;

    try {
      const post = window.Pollo.addPost({
        title: titleField.value,
        category: categoryField.value,
        thumbnail: thumbnailField.value,
        excerpt: excerptField.value,
        body: bodyField.value,
      });
      postForm.reset();
      showFeedback("Artigo publicado.", false, post);
      titleField.focus({ preventScroll: true });
    } catch (error) {
      showFeedback("Não foi possível publicar o artigo.", true, null);
    }
  });

  if (sessionIsOpen()) showAdmin();
  else showAuth();

  window.PolloUI.refreshIcons();
})();
