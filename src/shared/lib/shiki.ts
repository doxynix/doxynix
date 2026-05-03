import "server-only";

import { unstable_cache } from "next/cache";
import { createHighlighter } from "shiki";
import langConsole from "shiki/langs/console.mjs";
import langJSON from "shiki/langs/json.mjs";
import langMarkdown from "shiki/langs/markdown.mjs";
import langTs from "shiki/langs/typescript.mjs";
import themeDark from "shiki/themes/github-dark-dimmed.mjs";
import themeLight from "shiki/themes/github-light.mjs";

let highlighter: Awaited<ReturnType<typeof createHighlighter>> | null = null;

export async function getHighlighter() {
  highlighter ??= await createHighlighter({
    langs: [langTs, langJSON, langMarkdown, langConsole],
    themes: [themeDark, themeLight],
  });
  return highlighter;
}

async function highlight(code: string, lang: string, theme: "dark" | "light") {
  const hl = await getHighlighter();

  const shikiTheme = theme === "dark" ? "github-dark-dimmed" : "github-light";

  return hl.codeToHtml(code, {
    lang,
    theme: shikiTheme,
    transformers: [],
  });
}

export const highlightCode = async (
  code: string,
  lang: string = "typescript",
  theme: "dark" | "light" = "dark",
  cacheKey?: string
) => {
  const key = cacheKey ?? Buffer.from(code).toString("base64").slice(0, 32);

  return unstable_cache(
    async () => highlight(code, lang, theme),
    ["shiki-highlight", key, lang, theme],
    {
      revalidate: false,
      tags: ["shiki"],
    }
  )();
};
