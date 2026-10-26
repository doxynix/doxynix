import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { bundledLanguages, bundledLanguagesAlias } from "shiki/langs";
import { bundledThemes } from "shiki/themes";

import { type CodeTheme, codeThemeTone } from "@/shared/lib/appearance-preferences";

const PLAIN_LANGS = new Set(["text", "txt", "plaintext", "plain"]);

const EXTRA_ALIASES: Record<string, string> = {
  fortran: "fortran-free-form",
  golang: "go",
};

const LANG_GETTERS = bundledLanguages as Record<string, unknown>;
const ALIAS_GETTERS = bundledLanguagesAlias as Record<string, unknown>;
const THEME_GETTERS = bundledThemes as Record<string, unknown>;

const SYSTEM_FALLBACKS = {
  dark: "github-dark",
  light: "github-light",
} as const;

const THEME_ALIASES = {
  dark: "github-dark",
  light: "github-light",
};

const globalForShiki = globalThis as unknown as {
  doxynixClientShiki?: Promise<HighlighterCore>;
};

const loadingLangs = new Map<string, Promise<void>>();
const loadingThemes = new Map<string, Promise<void>>();

function getHighlighter(): Promise<HighlighterCore> {
  globalForShiki.doxynixClientShiki ??= createHighlighterCore({
    engine: createJavaScriptRegexEngine(),
    langs: [],
    themes: [],
  });
  return globalForShiki.doxynixClientShiki;
}

async function ensureTheme(highlighter: HighlighterCore, themeId: string): Promise<void> {
  if (highlighter.getLoadedThemes().includes(themeId)) {
    return;
  }
  if (loadingThemes.has(themeId)) {
    return loadingThemes.get(themeId);
  }

  const getter = THEME_GETTERS[themeId];
  if (getter == null) {
    return;
  }

  const promise = highlighter.loadTheme(getter).finally(() => {
    loadingThemes.delete(themeId);
  });

  loadingThemes.set(themeId, promise);
  return promise;
}

async function ensureLang(highlighter: HighlighterCore, lang: string): Promise<void> {
  if (highlighter.getLoadedLanguages().includes(lang)) {
    return;
  }
  if (loadingLangs.has(lang)) {
    return loadingLangs.get(lang);
  }

  const getter = LANG_GETTERS[lang] ?? ALIAS_GETTERS[lang];
  if (getter == null) {
    return;
  }

  const promise = highlighter.loadLanguage(getter as never).finally(() => {
    loadingLangs.delete(lang);
  });

  loadingLangs.set(lang, promise);
  return promise;
}

export const clientShiki = {
  async highlight(
    code: string,
    lang: string,
    theme: "dark" | "light" | Exclude<CodeTheme, "auto">,
  ): Promise<string | null> {
    try {
      const highlighter = await getHighlighter();

      const targetThemeId = (THEME_ALIASES as Record<string, string | undefined>)[theme] ?? theme;
      const targetLang = EXTRA_ALIASES[lang] ?? lang;

      await ensureTheme(highlighter, targetThemeId);

      const resolvedTheme = highlighter.getLoadedThemes().includes(targetThemeId)
        ? targetThemeId
        : SYSTEM_FALLBACKS[codeThemeTone(targetThemeId)];

      if (PLAIN_LANGS.has(targetLang)) {
        return highlighter.codeToHtml(code, { lang: "text", theme: resolvedTheme });
      }

      await ensureLang(highlighter, targetLang);

      if (!highlighter.getLoadedLanguages().includes(targetLang)) {
        return null;
      }

      return highlighter.codeToHtml(code, { lang: targetLang, theme: resolvedTheme });
    } catch {
      return null;
    }
  },
};
