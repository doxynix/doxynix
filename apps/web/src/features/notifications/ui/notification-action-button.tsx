"use client";

import type { ComponentType } from "react";

import { cn } from "@/shared/lib/cn";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

type Props = {
  className?: string;
  disabled: boolean;
  icon: ComponentType<{ className?: string }>;
  isPending: boolean;
  onClick: () => void;
  tooltip: string;
};

export function NotificationActionButton({
  className,
  disabled,
  icon: Icon,
  isPending,
  onClick,
  tooltip,
}: Readonly<Props>) {
  return (
    <AppTooltip content={tooltip}>
      <LoadingButton
        aria-label={tooltip}
        className={cn(
          "z-10 size-6 text-muted-foreground not-md:opacity-100 opacity-0 transition-standard hover:text-foreground group-hover:opacity-100",
          className,
        )}
        disabled={disabled}
        isLoading={isPending}
        loadingText=""
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }}
        size="icon"
        variant="ghost"
      >
        <Icon />
      </LoadingButton>
    </AppTooltip>
  );
}
