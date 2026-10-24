import MarkdownIt, { type RendererRule } from "markdown-it";
import ins from "markdown-it-ins";
import taskLists from "markdown-it-task-lists";

export const markdownIt = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: false,
  typographer: false,
});

// Match the old GFM autolink behavior for URLs like "www.example.com".
markdownIt.linkify.set({ fuzzyLink: true });

markdownIt.use(taskLists, {
  enabled: false,
  label: false,
});

markdownIt.use(ins);

// markdown-it renders table alignment as inline styles, which DOMPurify strips.
// Convert it to the `align` attribute before sanitization.
const renderTableCell: RendererRule = (tokens, idx, options, _env, renderer) => {
  const token = tokens[idx];
  if (!token) {
    return "";
  }

  const style = token.attrGet("style");
  if (style) {
    const alignment = /text-align:\s*(left|center|right)/.exec(String(style));
    if (alignment?.[1]) {
      token.attrSet("align", alignment[1]);
    }
    const styleIndex = token.attrIndex("style");
    if (styleIndex >= 0) {
      token.attrs?.splice(styleIndex, 1);
    }
  }

  return renderer.renderToken(tokens, idx, options);
};

markdownIt.renderer.rules.th_open = renderTableCell;
markdownIt.renderer.rules.td_open = renderTableCell;

// Keep the semantic element used by the site CSS for strikethrough.
markdownIt.renderer.rules.s_open = () => "<del>";
markdownIt.renderer.rules.s_close = () => "</del>";
