import "server-only";

import { createHash } from "node:crypto";

import { unstable_cache } from "next/cache";
import { bundledLanguages, bundledLanguagesAlias, codeToHtml } from "shiki";

const ALIASES: Record<string, string> = {
  fortran: "fortran-free-form",
  golang: "go",
};

function normalizeLang(lang: string): string {
  return ALIASES[lang] ?? lang;
}

function isKnownLang(lang: string): boolean {
  return lang in bundledLanguages || lang in bundledLanguagesAlias;
}

async function highlight(code: string, lang: string, theme: "dark" | "light") {
  const shikiTheme = theme === "dark" ? "github-dark-dimmed" : "github-light";
  const requested = normalizeLang(lang);
  const resolved = isKnownLang(requested) ? requested : "text";

  return codeToHtml(code, {
    lang: resolved,
    theme: shikiTheme,
    transformers: [],
  });
}

export const highlightCode = async (
  code: string,
  lang: string = "typescript",
  theme: "dark" | "light" = "dark",
  cacheKey?: string,
) => {
  const key = cacheKey ?? createHash("sha256").update(code).digest("hex").slice(0, 32);

  return unstable_cache(
    async () => highlight(code, lang, theme),
    ["shiki-highlight", key, normalizeLang(lang), theme],
    {
      revalidate: false,
      tags: ["shiki"],
    },
  )();
};
