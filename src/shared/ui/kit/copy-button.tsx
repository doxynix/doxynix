"use client";

import { Check, Copy } from "lucide-react";

import { useCopyToClipboard } from "@/shared/hooks/use-copy-to-clipboard";
import { cn } from "@/shared/lib/utils";

import { Button } from "../core/button";
import { AppTooltip } from "./app-tooltip";

type CopyButtonProps = {
  value: string;
  tooltipText?: string;
  successText?: string;
  className?: string;
};

export function CopyButton({
  value,
  tooltipText = "Copy ID",
  successText = "Copied!",
  className,
}: CopyButtonProps) {
  const { isCopied, copy } = useCopyToClipboard();

  return (
    <AppTooltip content={isCopied ? successText : tooltipText} open={isCopied ? true : undefined}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => copy(value)}
        className={cn(
          "h-6 w-6 transition-all not-md:opacity-100",
          isCopied
            ? "text-success hover:text-success opacity-100"
            : "text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100",
          className
        )}
      >
        {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </AppTooltip>
  );
}
