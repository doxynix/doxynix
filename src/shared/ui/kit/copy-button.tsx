"use client";

import { Check, Copy } from "lucide-react";

import { useCopyToClipboard } from "@/shared/hooks/use-copy-to-clipboard";
import { cn } from "@/shared/lib/cn";

import { Button } from "../core/button";
import { AppTooltip } from "./app-tooltip";

type Props = {
  className?: string;
  disabled?: boolean;
  tooltipSide?: "bottom" | "left" | "right" | "top";
  tooltipText?: string;
  value: string;
};

export function CopyButton({
  className,
  disabled,
  tooltipSide,
  tooltipText = "Copy ID",
  value,
}: Readonly<Props>) {
  const { copy, isCopied } = useCopyToClipboard();

  return (
    <AppTooltip content={tooltipText} side={tooltipSide}>
      <Button
        type="button"
        disabled={disabled}
        size="icon"
        variant="ghost"
        aria-label={tooltipText}
        onClick={() => void copy(value)}
        className={cn(
          "relative size-6 transition-all not-md:opacity-100",
          "group/copy-btn",
          !isCopied &&
            "text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100",
          isCopied && "text-success pointer-events-none opacity-100",
          className
        )}
      >
        <Copy
          className={cn(
            "absolute size-3.5 transition-all duration-300",
            isCopied ? "scale-0 opacity-0" : "scale-100 opacity-100"
          )}
        />

        <Check
          className={cn(
            "text-success absolute size-3.5 transition-all duration-300",
            isCopied ? "scale-100 opacity-100" : "scale-0 opacity-0"
          )}
        />

        <span className="sr-only">Copy</span>
      </Button>
    </AppTooltip>
  );
}
