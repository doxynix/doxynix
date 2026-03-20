"use client";

import { Check, Copy } from "lucide-react";

import { useCopyToClipboard } from "@/shared/hooks/use-copy-to-clipboard";
import { cn } from "@/shared/lib/utils";

import { Button } from "../core/button";
import { AppTooltip } from "./app-tooltip";

type CopyButtonProps = {
  className?: string;
  successText?: string;
  tooltipText?: string;
  value: string;
};

export function CopyButton({
  className,
  successText = "Copied!",
  tooltipText = "Copy ID",
  value,
}: Readonly<CopyButtonProps>) {
  const { copy, isCopied } = useCopyToClipboard();

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void copy(value);
  };

  return (
    <AppTooltip content={isCopied ? successText : tooltipText} open={isCopied ? true : undefined}>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={handleCopy}
        className={cn(
          "size-6 transition-all not-md:opacity-100",
          isCopied
            ? "text-success hover:text-success opacity-100"
            : "text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100",
          className
        )}
      >
        {isCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </Button>
    </AppTooltip>
  );
}
