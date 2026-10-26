"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { codeThemeTone } from "@/shared/lib/appearance-preferences";
import { clientShiki } from "@/shared/lib/client-shiki";
import { useCodeTheme } from "@/shared/lib/hooks/use-appearance-preferences";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from "@/shared/ui/core/code-block";

type Props = {
  code: string;
  isStreaming: boolean;
  lang: string;
};

export function ChatCodeBlock({ code, isStreaming, lang }: Readonly<Props>) {
  const codeTheme = useCodeTheme();
  const { resolvedTheme } = useTheme();
  const appTone = resolvedTheme === "light" ? "light" : "dark";
  const theme = codeTheme === "auto" || codeThemeTone(codeTheme) !== appTone ? appTone : codeTheme;
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
    <CodeBlock className="my-3 w-full rounded-xl border border-border bg-background font-sans text-base">
      <CodeBlockHeader className="border-b border-border bg-muted/40 px-4 py-1.5 text-sm font-medium text-muted-foreground select-none">
        <CodeBlockTitle>{lang}</CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton value={code} />
        </CodeBlockActions>
      </CodeBlockHeader>
      {html == null ? (
        <CodeBlockContent className="overflow-x-auto p-4 font-mono text-base [&_pre]:!m-0 [&_pre]:!p-0 [&_pre]:!bg-transparent">
          <pre>
            <code className="text-base">{code}</code>
          </pre>
        </CodeBlockContent>
      ) : (
        <div className="overflow-x-auto p-4 font-mono text-base [&_pre]:!m-0 [&_pre]:!p-0 [&_pre]:!bg-transparent">
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      )}
    </CodeBlock>
  );
}
