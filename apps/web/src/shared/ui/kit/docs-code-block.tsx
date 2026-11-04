"use client";

import { useRef } from "react";
import { CodeBlock, type CodeBlockProps, Pre } from "fumadocs-ui/components/codeblock";

import { CopyButton } from "./copy-button";

export function DocsCodeBlock({ children, ...props }: CodeBlockProps) {
  const ref = useRef<HTMLElement>(null);

  return (
    <CodeBlock
      Actions={({ className }) => (
        <div className={className}>
          <CopyButton
            alwaysVisible
            getValue={() => {
              const pre = ref.current?.querySelector("pre");

              if (pre == null) {
                return "";
              }

              const clone = pre.cloneNode(true) as HTMLElement;
              clone.querySelectorAll(".nd-copy-ignore").forEach((node) => node.replaceWith("\n"));

              return clone.textContent;
            }}
            tooltipText="Copy code"
          />
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
