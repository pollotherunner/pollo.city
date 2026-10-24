declare module "highlight.js/lib/languages/*" {
  import type { LanguageFn } from "highlight.js";
  const language: LanguageFn;
  export default language;
}

declare module "prismjs/components/*";

declare module "@toast-ui/editor/dist/i18n/pt-br";
