"use client";

import type { ComponentType } from "react";

import { cn } from "@/shared/lib/utils";
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
        disabled={disabled}
        isLoading={isPending}
        size="icon"
        variant="ghost"
        aria-label={tooltip}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }}
        className={cn(
          "text-muted-foreground hover:text-foreground z-10 h-6 w-6 opacity-0 transition-all not-md:opacity-100 group-hover:opacity-100",
          className
        )}
      >
        <Icon className="h-4 w-4" />
      </LoadingButton>
    </AppTooltip>
  );
}
