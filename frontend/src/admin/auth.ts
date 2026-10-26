import { api, ApiError } from "@/api/client";
import { byId } from "@/lib/dom";
import { refreshIcons } from "@/lib/icons";

interface AuthCallbacks {
  onAuthenticated(): Promise<void> | void;
  onLogout(): void;
  onLogoutError(message: string): void;
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

  showSessionExpired(): void {
    this.error.textContent = "Sua sessão expirou. Entre novamente.";
    this.error.hidden = false;
  }

  private async login(): Promise<void> {
    this.error.hidden = true;
    this.password.removeAttribute("aria-invalid");

    try {
      await api.login(this.password.value);
      this.password.value = "";
      await this.callbacks.onAuthenticated();
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        this.error.textContent = "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
      } else if (error instanceof ApiError && error.status === 401) {
        this.error.textContent = "Senha incorreta. Tente de novo.";
      } else {
        this.error.textContent = "Não foi possível entrar agora.";
      }
      this.error.hidden = false;
      this.password.setAttribute("aria-invalid", "true");
      this.password.focus();
      this.password.select();
    }
  }

  private async logout(): Promise<void> {
    try {
      await api.logout();
      this.callbacks.onLogout();
    } catch {
      this.callbacks.onLogoutError("Não foi possível sair. Tente novamente.");
    }
  }
}
