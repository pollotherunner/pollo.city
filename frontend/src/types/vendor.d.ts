declare module "highlight.js/lib/languages/*" {
  import type { LanguageFn } from "highlight.js";
  const language: LanguageFn;
  export default language;
}

declare module "markdown-it-task-lists" {
  import type MarkdownIt from "markdown-it";

  interface TaskListOptions {
    enabled?: boolean;
    label?: boolean;
    labelAfter?: boolean;
  }

  const plugin: (md: MarkdownIt, options?: TaskListOptions) => void;
  export default plugin;
}
