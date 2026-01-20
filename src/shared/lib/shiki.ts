import "server-only";

import { unstable_cache } from "next/cache";
import { createHighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import langJSON from "shiki/langs/json.mjs";
import langMarkdown from "shiki/langs/markdown.mjs";
import langTs from "shiki/langs/typescript.mjs";
import themeDark from "shiki/themes/github-dark-dimmed.mjs";

let highlighter: Awaited<ReturnType<typeof createHighlighterCore>> | null = null;

async function getHighlightedCode(code: string, lang: string, theme: "dark" | "light") {
  if (!highlighter) {
    highlighter = await createHighlighterCore({
      themes: [themeDark],
      langs: [langTs, langJSON, langMarkdown],
      engine: createOnigurumaEngine(() => import("shiki/wasm")),
    });
  }

  return highlighter.codeToHtml(code, {
    lang: lang,
    theme: theme === "dark" ? "github-dark-dimmed" : "github-dark-dimmed",
    transformers: [],
  });
}

export const highlightCode = unstable_cache(
  async (code: string, lang: string = "typescript", theme: "dark" | "light" = "dark") => {
    return getHighlightedCode(code, lang, theme);
  },
  ["shiki-code-highlight"],
  {
    revalidate: false,
  }
);
