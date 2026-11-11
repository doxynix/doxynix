"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { type CodeTheme, codeThemeTone } from "@/shared/lib/appearance-preferences";
import { clientShiki, type ShikiTokenLines } from "@/shared/lib/client-shiki";

import { useCodeTheme } from "./use-appearance-preferences";

export type ShikiTheme = "dark" | "light" | Exclude<CodeTheme, "auto">;

type Options = {
  delay?: number;
  enabled?: boolean;
};

type Loader<T> = (code: string, lang: string, theme: ShikiTheme) => Promise<T | null>;

const highlightLoader: Loader<string> = (code, lang, theme) =>
  clientShiki.highlight(code, lang, theme);

const tokenizeLoader: Loader<ShikiTokenLines> = (code, lang, theme) =>
  clientShiki.tokenizeLines(code, lang, theme);

type HighlightResult<T> = {
  html: null | T;
  key: string;
};

function useShikiResult<T>(
  code: string,
  lang: string,
  theme: ShikiTheme,
  loader: Loader<T>,
  { delay = 120, enabled = true }: Options = {},
) {
  const [result, setResult] = useState<HighlightResult<T> | null>(null);
  const key = `${theme}\u0000${lang}\u0000${code}`;

  useEffect(() => {
    if (!enabled || code === "") {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void loader(code, lang, theme).then((html) => {
        if (!cancelled) {
          setResult({ html, key });
        }
      });
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code, delay, enabled, key, lang, loader, theme]);

  return {
    html: result?.key === key ? result.html : null,
    pending: enabled && code !== "" && result?.key !== key,
  };
}

export function useShikiHighlight(
  code: string,
  lang: string,
  theme: ShikiTheme,
  options: Options = {},
) {
  return useShikiResult(code, lang, theme, highlightLoader, options);
}

export function useShikiTokenLines(
  code: string,
  lang: string,
  enabled = true,
): ShikiTokenLines | null {
  const theme = useShikiTheme();

  return useShikiResult(code, lang, theme, tokenizeLoader, { enabled }).html;
}

export function useShikiTheme(): ShikiTheme {
  const codeTheme = useCodeTheme();
  const { resolvedTheme } = useTheme();
  const appTone = resolvedTheme === "light" ? "light" : "dark";

  return codeTheme === "auto" || codeThemeTone(codeTheme) !== appTone ? appTone : codeTheme;
}

export function useShikiHtml(code: string, lang: string, enabled = true): null | string {
  const theme = useShikiTheme();

  return useShikiHighlight(code, lang, theme, { enabled }).html;
}
