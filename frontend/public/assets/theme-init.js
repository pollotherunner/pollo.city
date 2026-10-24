(function () {
  var theme = "light";
  var prefersDark = false;

  try {
    prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch (error) {
    prefersDark = false;
  }

  try {
    var stored = window.localStorage.getItem("pollo.theme");
    if (stored === "dark" || stored === "light") {
      theme = stored;
    } else if (prefersDark) {
      theme = "dark";
    }
  } catch (error) {
    theme = prefersDark ? "dark" : "light";
  }

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;

  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", theme === "dark" ? "#0b0b0b" : "#ffffff");
  }
})();
