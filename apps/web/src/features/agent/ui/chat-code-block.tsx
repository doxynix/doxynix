"use client";

import { useShikiHtml } from "@/shared/lib/hooks/use-shiki-highlight";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockHtml,
  CodeBlockTitle,
} from "@/shared/ui/core/code-block";

type Props = {
  code: string;
  isStreaming: boolean;
  lang: string;
};

export function ChatCodeBlock({ code, isStreaming, lang }: Readonly<Props>) {
  const html = useShikiHtml(code, lang, !isStreaming);

  return (
    <CodeBlock className="my-3 w-full rounded-xl border border-border bg-background font-sans text-base">
      <CodeBlockHeader className="border-b border-border bg-muted/40 px-4 py-1.5 text-sm font-medium text-muted-foreground select-none">
        <CodeBlockTitle>{lang}</CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton value={code} />
        </CodeBlockActions>
      </CodeBlockHeader>
      {html == null ? (
        <CodeBlockContent className="overflow-x-auto p-4 font-mono text-base">
          {code}
        </CodeBlockContent>
      ) : (
        <CodeBlockHtml
          className="overflow-x-auto p-4 font-mono text-base"
          html={html}
        />
      )}
    </CodeBlock>
  );
}
