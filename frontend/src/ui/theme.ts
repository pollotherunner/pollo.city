import { refreshIcons } from "@/lib/icons";

export type Theme = "light" | "dark";

const STORAGE_KEY = "pollo.theme";
const EVENT_NAME = "pollo:themechange";

function isTheme(value: string | null | undefined): value is Theme {
  return value === "light" || value === "dark";
}

function storedTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function onThemeChange(listener: (theme: Theme) => void): () => void {
  const handler = (event: Event): void => {
    if (event instanceof CustomEvent && isTheme(event.detail)) {
      listener(event.detail);
    }
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}

function applyTheme(theme: Theme, persist: boolean): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;

  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) {
    meta.content = theme === "dark" ? "#0b0b0b" : "#ffffff";
  }

  if (persist) {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Theme still applies for the current page.
    }
  }

  const button = document.querySelector<HTMLButtonElement>(".theme-toggle");
  if (button) {
    const isDark = theme === "dark";
    const label = isDark ? "Ativar modo claro" : "Ativar modo escuro";
    button.innerHTML = `<i data-lucide="${isDark ? "sun" : "moon"}"></i>`;
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    button.setAttribute("aria-pressed", String(isDark));
    refreshIcons(button);
  }

  window.dispatchEvent(new CustomEvent<Theme>(EVENT_NAME, { detail: theme }));
}

export function mountThemeToggle(): void {
  const button = document.querySelector<HTMLButtonElement>(".theme-toggle");
  if (!button) {
    return;
  }

  const initial = storedTheme() ?? (isTheme(document.documentElement.dataset.theme) ? document.documentElement.dataset.theme : systemTheme());
  applyTheme(initial, false);

  button.addEventListener("click", () => {
    applyTheme(currentTheme() === "dark" ? "light" : "dark", true);
  });

  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (!storedTheme()) {
      applyTheme(systemTheme(), false);
    }
  });

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY && isTheme(event.newValue)) {
      applyTheme(event.newValue, false);
    }
  });
}
