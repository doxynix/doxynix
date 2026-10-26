"use client";

import { useEffect, useState } from "react";

import type { CodeTheme } from "@/shared/lib/appearance-preferences";
import { clientShiki } from "@/shared/lib/client-shiki";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { CodeWindow } from "@/shared/ui/kit/code-window";

function plainHtml(code: string): string {
  return `<pre><code>${code
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")}</code></pre>`;
}

type Props = {
  code: string;
  lang: string;
  title: string;
  theme: Exclude<CodeTheme, "auto">;
  tone: "dark" | "light";
};

export function CodePreview({ code, lang, title, theme, tone }: Readonly<Props>) {
  const [html, setHtml] = useState<string | null>();

  useEffect(() => {
    let cancelled = false;

    void clientShiki.highlight(code, lang, theme).then((result) => {
      if (!cancelled) {
        setHtml(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [code, lang, theme]);

  if (html === undefined) {
    return <Skeleton className="h-44 w-full rounded-xl" />;
  }

  return (
    <CodeWindow
      code={code}
      codeHtml={html ?? plainHtml(code)}
      copyButtonVisible={false}
      title={title}
      tone={tone}
    />
  );
}
