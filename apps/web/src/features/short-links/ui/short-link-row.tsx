"use client";

import { Check, Copy, Link2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/shared/lib/cn";
import { useCopyToClipboard } from "@/shared/lib/hooks/use-copy-to-clipboard";
import { AppButton } from "@/shared/ui/core/button";

type Props = {
  label: string;
  path: string;
  url: string;
};

export function ShortLinkRow({ label, path, url }: Readonly<Props>) {
  const tCommon = useTranslations("Common");
  const { copy, isCopied } = useCopyToClipboard();

  return (
    <AppButton
      aria-label={`${tCommon("copy")} ${label} (${path})`}
      className="group w-full justify-between text-left font-normal"
      onClick={() => {
        void copy(url);
      }}
      type="button"
      variant="ghost"
    >
      <span className="flex min-w-0 items-center gap-2">
        <Link2 className="text-muted-foreground" />
        <span className="truncate text-foreground text-sm">{label}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{path}</code>
        <span className="relative size-4">
          <Copy
            className={cn(
              "absolute inset-0 text-muted-foreground transition-opacity",
              isCopied
                ? "opacity-0"
                : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 not-md:opacity-100",
            )}
          />
          <Check
            className={cn(
              "absolute inset-0 text-muted-foreground transition-opacity",
              isCopied ? "opacity-100" : "opacity-0",
            )}
          />
        </span>
      </span>
    </AppButton>
  );
}
