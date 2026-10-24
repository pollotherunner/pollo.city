import { api, ApiError } from "@/api/client";
import { byId } from "@/lib/dom";
import { refreshIcons } from "@/lib/icons";

interface AuthCallbacks {
  onAuthenticated(): Promise<void> | void;
  onLogout(): void;
}

export class AuthView {
  private readonly form = byId<HTMLFormElement>("login-form");
  private readonly password = byId<HTMLInputElement>("admin-password");
  private readonly passwordToggle = byId<HTMLButtonElement>("password-toggle");
  private readonly error = byId<HTMLElement>("login-error");
  private readonly logoutButton = byId<HTMLButtonElement>("logout-button");

  constructor(private readonly callbacks: AuthCallbacks) {}

  mount(): void {
    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.login();
    });

    this.password.addEventListener("input", () => {
      this.error.hidden = true;
      this.password.removeAttribute("aria-invalid");
    });

    this.passwordToggle.addEventListener("click", () => {
      const isPassword = this.password.type === "password";
      this.password.type = isPassword ? "text" : "password";
      this.passwordToggle.setAttribute("aria-pressed", String(isPassword));
      this.passwordToggle.setAttribute("aria-label", isPassword ? "Ocultar senha" : "Mostrar senha");
      this.passwordToggle.innerHTML = isPassword ? '<i data-lucide="eye-off"></i>' : '<i data-lucide="eye"></i>';
      refreshIcons(this.passwordToggle);
      this.password.focus();
    });

    this.logoutButton.addEventListener("click", () => {
      void this.logout();
    });
  }

  async restoreSession(): Promise<boolean> {
    try {
      return await api.getSession();
    } catch {
      return false;
    }
  }

  clearPassword(): void {
    this.password.value = "";
    this.error.hidden = true;
    this.password.removeAttribute("aria-invalid");
  }

  private async login(): Promise<void> {
    this.error.hidden = true;
    this.password.removeAttribute("aria-invalid");

    try {
      await api.login(this.password.value);
      this.password.value = "";
      await this.callbacks.onAuthenticated();
    } catch (error) {
      this.error.textContent =
        error instanceof ApiError && error.status === 401
          ? "Senha incorreta. Tente de novo."
          : "Não foi possível entrar agora.";
      this.error.hidden = false;
      this.password.setAttribute("aria-invalid", "true");
      this.password.focus();
      this.password.select();
    }
  }

  private async logout(): Promise<void> {
    try {
      await api.logout();
    } catch {
      // The local session is cleared even if the request fails.
    }
    this.callbacks.onLogout();
  }
}
