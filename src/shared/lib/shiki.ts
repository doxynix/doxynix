import "server-only";

import { unstable_cache } from "next/cache";
import { createHighlighter } from "shiki";
import langConsole from "shiki/langs/console.mjs";
import langJSON from "shiki/langs/json.mjs";
import langMarkdown from "shiki/langs/markdown.mjs";
import langTs from "shiki/langs/typescript.mjs";
import themeDark from "shiki/themes/github-dark-dimmed.mjs";

let highlighter: Awaited<ReturnType<typeof createHighlighter>> | null = null;

async function getHighlighter() {
  highlighter ??= await createHighlighter({
    langs: [langTs, langJSON, langMarkdown, langConsole],
    themes: [themeDark],
  });
  return highlighter;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function highlight(code: string, lang: string, theme: "dark" | "light") {
  // NOTE: временно! пока не вернется светлая тема!
  const hl = await getHighlighter();

  return hl.codeToHtml(code, {
    lang,
    theme: "github-dark-dimmed",
    transformers: [],
  });
}

export const highlightCode = async (
  code: string,
  lang: string = "typescript",
  theme: "dark" | "light" = "dark"
) => {
  const hash = Buffer.from(code).toString("base64").slice(0, 32);

  return unstable_cache(
    async () => highlight(code, lang, theme),
    ["shiki-highlight", hash, lang, theme],
    {
      revalidate: false,
      tags: ["shiki"],
    }
  )();
};
