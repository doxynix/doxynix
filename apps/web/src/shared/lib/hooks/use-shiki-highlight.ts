"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { type CodeTheme, codeThemeTone } from "@/shared/lib/appearance-preferences";
import { clientShiki } from "@/shared/lib/client-shiki";

import { useCodeTheme } from "./use-appearance-preferences";

export type ShikiTheme = "dark" | "light" | Exclude<CodeTheme, "auto">;

type Options = {
  delay?: number;
  enabled?: boolean;
};

type HighlightResult = {
  html: null | string;
  key: string;
};

export function useShikiHighlight(
  code: string,
  lang: string,
  theme: ShikiTheme,
  { delay = 120, enabled = true }: Options = {},
) {
  const [result, setResult] = useState<HighlightResult | null>(null);
  const key = `${theme}\u0000${lang}\u0000${code}`;

  useEffect(() => {
    if (!enabled || code === "") {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void clientShiki.highlight(code, lang, theme).then((html) => {
        if (!cancelled) {
          setResult({ html, key });
        }
      });
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code, delay, enabled, key, lang, theme]);

  return {
    html: result?.key === key ? result.html : null,
    pending: enabled && code !== "" && result?.key !== key,
  };
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
