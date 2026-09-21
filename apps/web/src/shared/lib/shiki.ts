import "server-only";

import { createHash } from "node:crypto";

import { unstable_cache } from "next/cache";
import { bundledLanguages, bundledLanguagesAlias, codeToHtml } from "shiki";

/**
 * Shorthand names that shiki itself does not resolve.
 * Everything else (js/ts/py/sh/shell/…, ~450 ids incl. 346 languages)
 * is already a direct key or alias in the `shiki/langs` bundle.
 */
const ALIASES: Record<string, string> = {
  // shiki v4 splits Fortran into fixed/free form grammars.
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
  // The codeToHtml shorthand throws for languages that are not part of the
  // bundle, so unknown file extensions resolve to plain text instead.
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
