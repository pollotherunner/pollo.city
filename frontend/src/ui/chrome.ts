import { query } from "@/lib/dom";
import { refreshIcons } from "@/lib/icons";
import { mountFooter } from "./footer";
import { mountHeader } from "./header";
import { currentPage } from "./page";
import { SearchDialog } from "./search";

export function mountSiteChrome(): void {
  const headerHost = query<HTMLElement>("[data-site-header]");
  const footerHost = query<HTMLElement>("[data-site-footer]");

  mountHeader(headerHost, currentPage());
  mountFooter(footerHost);
  new SearchDialog().mount();
  refreshIcons();
}
