"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { clientShiki } from "@/shared/lib/client-shiki";
import { CopyButton } from "@/shared/ui/kit/copy-button";

type Props = {
  code: string;
  lang: string;
  isStreaming: boolean;
};

/**
 * Streams a code block as a layout-stable plain `<pre>` and swaps in the
 * Shiki-highlighted HTML once the block settles (message stopped streaming
 * + a short debounce). Avoids re-running the highlighter on every token.
 */
export function ChatCodeBlock({ code, lang, isStreaming }: Readonly<Props>) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "light" ? "light" : "dark";
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    if (isStreaming) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void clientShiki.highlight(code, lang, theme).then((result) => {
        if (!cancelled) {
          setHtml(result);
        }
      });
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code, lang, theme, isStreaming]);

  return (
    <div className="not-prose group relative my-3 w-full rounded-xl border border-border bg-background font-sans text-xs">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-1.5 text-[10px] font-medium text-muted-foreground select-none">
        <span>{lang}</span>
        <CopyButton value={code} />
      </div>

      <div className="overflow-x-auto p-4 font-mono text-xs [&_pre]:!m-0 [&_pre]:!p-0 [&_pre]:!bg-transparent">
        {html == null ? (
          <pre>
            <code>{code}</code>
          </pre>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </div>
    </div>
  );
}
