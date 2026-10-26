import { api } from "@/api/client";
import { query } from "@/lib/dom";
import { mountSiteChrome } from "@/ui/chrome";

mountSiteChrome();

const title = query<HTMLElement>("#sobre-title");
const lede = query<HTMLElement>("#sobre-lede");
const status = query<HTMLElement>("#sobre-status");
const body = query<HTMLElement>("#sobre-body");
const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');

try {
  const about = await api.getAbout();
  status.hidden = true;
  title.textContent = about.title;
  title.hidden = !about.title;
  lede.textContent = about.lede;
  lede.hidden = !about.lede;
  document.title = about.title ? `${about.title} — pollo.city` : "pollo.city";
  if (description) {
    description.content = about.lede;
  }

  if (about.body.trim()) {
    const { enhanceContent, renderMarkdown } = await import("@/lib/markdown");
    body.innerHTML = renderMarkdown(about.body);
    body.hidden = false;
    enhanceContent(body);
  } else {
    body.hidden = true;
  }
} catch {
  title.hidden = true;
  lede.hidden = true;
  body.hidden = true;
  status.textContent = "Não foi possível carregar esta página.";
  status.hidden = false;
  document.title = "pollo.city";
  if (description) {
    description.content = "";
  }
}
