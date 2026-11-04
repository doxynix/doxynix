"use client";

import { useRef } from "react";
import { CodeBlock, type CodeBlockProps, Pre } from "fumadocs-ui/components/codeblock";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { CheckIcon, CopyIcon } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { useCopyToClipboard } from "@/shared/lib/hooks/use-copy-to-clipboard";

export function DocsCodeBlock({ children, ...props }: CodeBlockProps) {
  const ref = useRef<HTMLElement>(null);
  const { copy, isCopied } = useCopyToClipboard();

  const handleCopy = () => {
    const pre = ref.current?.querySelector("pre");

    if (pre == null) {
      return;
    }

    const clone = pre.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(".nd-copy-ignore").forEach((node) => node.replaceWith("\n"));

    void copy(clone.textContent);
  };

  return (
    <CodeBlock
      Actions={({ className }) => (
        <div className={className}>
          <button
            aria-label={isCopied ? "Copied code" : "Copy code"}
            className={cn(buttonVariants({ size: "icon-xs", variant: "ghost" }))}
            onClick={handleCopy}
            type="button"
          >
            {isCopied ? <CheckIcon /> : <CopyIcon />}
          </button>
        </div>
      )}
      allowCopy={false}
      ref={ref}
      {...props}
    >
      <Pre>{children}</Pre>
    </CodeBlock>
  );
}
