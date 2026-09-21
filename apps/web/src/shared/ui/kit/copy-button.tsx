"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/shared/lib/cn";
import { useCopyToClipboard } from "@/shared/lib/hooks/use-copy-to-clipboard";

import { AppButton } from "../core/button";
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
  tooltipText,
  value,
}: Readonly<Props>) {
  const { copy, isCopied } = useCopyToClipboard();
  const tCommon = useTranslations("Common");
  const label = tooltipText ?? tCommon("copy_id");

  return (
    <AppTooltip
      content={label}
      side={tooltipSide}
    >
      <AppButton
        aria-label={label}
        className={cn(
          "relative size-6 not-md:opacity-100 transition-standard duration-300",
          "group/copy-btn",
          !isCopied &&
            "text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100",
          isCopied && "pointer-events-none text-success opacity-100",
          className,
        )}
        disabled={disabled}
        onClick={() => void copy(value)}
        size="icon"
        type="button"
        variant="ghost"
      >
        <Copy
          className={cn(
            "absolute size-3.5 transition-standard duration-300",
            isCopied ? "scale-0 opacity-0" : "scale-100 opacity-100",
          )}
        />

        <Check
          className={cn(
            "absolute size-3.5 text-success transition-standard duration-300",
            isCopied ? "scale-100 opacity-100" : "scale-0 opacity-0",
          )}
        />

        <span className="sr-only">{tCommon("copy")}</span>
      </AppButton>
    </AppTooltip>
  );
}
