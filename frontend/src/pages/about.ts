import { api } from "@/api/client";
import { query } from "@/lib/dom";
import { mountSiteChrome } from "@/ui/chrome";

mountSiteChrome();

const title = query<HTMLElement>("#sobre-title");
const lede = query<HTMLElement>("#sobre-lede");
const body = query<HTMLElement>("#sobre-body");
const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');

try {
  const about = await api.getAbout();
  title.textContent = about.title || "Sobre";
  lede.textContent = about.lede;
  lede.hidden = !about.lede;
  document.title = `${title.textContent} — pollo.city`;
  if (description && about.lede) {
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
  body.hidden = true;
}
