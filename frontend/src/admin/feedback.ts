import { byId, query } from "@/lib/dom";
import { refreshIcons } from "@/lib/icons";

interface FeedbackLink {
  slug: string;
}

export class AdminFeedback {
  private readonly root = byId<HTMLElement>("admin-feedback");
  private readonly message = query<HTMLElement>(".feedback-message", this.root);
  private readonly mark = query<HTMLElement>(".feedback-mark", this.root);
  private readonly link = byId<HTMLAnchorElement>("published-link");

  show(message: string, link?: FeedbackLink, isError = false): void {
    this.root.hidden = false;
    this.root.classList.toggle("is-error", isError);
    this.message.textContent = message;
    this.mark.innerHTML = `<i data-lucide="${isError ? "alert-circle" : "check"}"></i>`;
    this.link.hidden = !link;
    if (link) {
      this.link.href = `/post/${encodeURIComponent(link.slug)}`;
    }
    refreshIcons(this.root);
  }

  hide(): void {
    this.root.hidden = true;
  }
}
