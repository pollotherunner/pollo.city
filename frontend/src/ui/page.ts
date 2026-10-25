export type PageKind = "home" | "post" | "off-topic" | "archive" | "about" | "admin";

export function currentPage(): PageKind {
  const page = document.body.dataset.page;
  if (page === "post" || page === "off-topic" || page === "archive" || page === "about" || page === "admin") {
    return page;
  }
  return "home";
}
