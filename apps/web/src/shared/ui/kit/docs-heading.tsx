"use client";

import { type ComponentPropsWithoutRef, createElement } from "react";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { CheckIcon, PaperclipIcon } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { useCopyToClipboard } from "@/shared/lib/hooks/use-copy-to-clipboard";

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

type Props = ComponentPropsWithoutRef<"h2"> & {
  as?: HeadingTag;
};

export function DocsHeading({ as = "h2", children, className, id, ...props }: Props) {
  const { copy, isCopied } = useCopyToClipboard();

  if (id == null) {
    return createElement(as, { className, ...props }, children);
  }

  return createElement(
    as,
    {
      ...props,
      className: cn("group/heading flex scroll-m-28 flex-row items-center gap-1", className),
      id,
    },
    <a
      data-card=""
      href={`#${id}`}
      key="anchor"
    >
      {children}
    </a>,
    <button
      aria-label={isCopied ? "Copied anchor link" : "Copy anchor link"}
      aria-live="polite"
      className={cn(
        buttonVariants({ size: "icon-xs", variant: "ghost" }),
        "not-prose shrink-0 text-fd-muted-foreground opacity-0 transition-opacity group-hover/heading:opacity-100",
      )}
      key="copy"
      onClick={() => {
        const url = new URL(window.location.href);
        url.hash = id;
        void copy(url.href);
      }}
      type="button"
    >
      {isCopied ? <CheckIcon /> : <PaperclipIcon />}
    </button>,
  );
}
