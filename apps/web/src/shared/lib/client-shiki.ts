import langBash from "@shikijs/langs/bash";
import langCss from "@shikijs/langs/css";
import langGo from "@shikijs/langs/go";
import langHtml from "@shikijs/langs/html";
import langJava from "@shikijs/langs/java";
import langJavascript from "@shikijs/langs/javascript";
import langJson from "@shikijs/langs/json";
import langKotlin from "@shikijs/langs/kotlin";
import langMarkdown from "@shikijs/langs/markdown";
import langPython from "@shikijs/langs/python";
import langRuby from "@shikijs/langs/ruby";
import langRust from "@shikijs/langs/rust";
import langSql from "@shikijs/langs/sql";
import langTsx from "@shikijs/langs/tsx";
import langTypeScript from "@shikijs/langs/typescript";
import langYaml from "@shikijs/langs/yaml";
import themeGithubDark from "@shikijs/themes/github-dark";
import themeGithubLight from "@shikijs/themes/github-light";
import type { DynamicImportLanguageRegistration } from "shiki";
import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { bundledLanguages, bundledLanguagesAlias } from "shiki/langs";

/**
 * Client-side Shiki highlighter (fine-grained bundle):
 * - no WASM — uses the pure-JS regex engine;
 * - a small set of hot languages ships in the initial chunk;
 * - every other bundled language is loaded on
 *   demand as its own lazy chunk via `shiki/langs` getters.
 *
 * `highlight` never throws: unknown languages resolve to `null` and the
 * caller falls back to a plain `<pre>`.
 */

/** Plain-text pseudo-languages that need no grammar. */
const PLAIN_LANGS = new Set(["text", "txt", "plaintext", "plain"]);

/** Shorthands missing from shiki's own alias map (shiki v4 splits Fortran). */
const EXTRA_ALIASES: Record<string, string> = {
  fortran: "fortran-free-form",
  golang: "go",
};

/** Every bundled language and alias resolves to its lazy import getter. */
const LANG_GETTERS = bundledLanguages as Record<string, DynamicImportLanguageRegistration>;
const ALIAS_GETTERS = bundledLanguagesAlias as Record<string, DynamicImportLanguageRegistration>;

const globalForShiki = globalThis as unknown as {
  doxynixClientShiki?: Promise<HighlighterCore>;
};

function getHighlighter(): Promise<HighlighterCore> {
  globalForShiki.doxynixClientShiki ??= createHighlighterCore({
    engine: createJavaScriptRegexEngine(),
    langs: [
      langBash,
      langCss,
      langGo,
      langHtml,
      langJava,
      langJavascript,
      langJson,
      langKotlin,
      langMarkdown,
      langPython,
      langRuby,
      langRust,
      langSql,
      langTsx,
      langTypeScript,
      langYaml,
    ],
    themes: [themeGithubDark, themeGithubLight],
  });

  return globalForShiki.doxynixClientShiki;
}

async function loadLang(highlighter: HighlighterCore, rawLang: string): Promise<string | null> {
  const lang = EXTRA_ALIASES[rawLang] ?? rawLang;

  if (PLAIN_LANGS.has(lang)) {
    return "text";
  }

  if (highlighter.getLoadedLanguages().includes(lang)) {
    return lang;
  }

  const getter = LANG_GETTERS[lang] ?? ALIAS_GETTERS[lang];

  if (getter == null) {
    return null;
  }

  try {
    await highlighter.loadLanguage(getter);
    return lang;
  } catch {
    return null;
  }
}

export const clientShiki = {
  async highlight(code: string, lang: string, theme: "dark" | "light"): Promise<string | null> {
    try {
      const highlighter = await getHighlighter();
      const resolved = await loadLang(highlighter, lang);

      if (resolved == null) {
        return null;
      }

      return highlighter.codeToHtml(code, {
        lang: resolved,
        theme: theme === "dark" ? "github-dark" : "github-light",
      });
    } catch {
      return null;
    }
  },
};
