import type { ComponentProps } from "react";

import { cn } from "@/shared/lib/cn";
import { AppBadge } from "@/shared/ui/core/badge";

const TONES = {
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
  info: "border-info/30 bg-info/10 text-info",
  neutral: "border-border bg-surface-hover text-muted-foreground",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
} as const;

const SIZES = {
  default: "px-2 py-0.5 text-xs",
  sm: "px-1.5 py-0 text-2xs",
} as const;

export type StatusTone = keyof typeof TONES;
export type StatusBadgeSize = keyof typeof SIZES;

type Props = Omit<ComponentProps<typeof AppBadge>, "variant"> & {
  dot?: boolean;
  size?: StatusBadgeSize;
  tone?: StatusTone;
};

export function StatusBadge({
  children,
  className,
  dot = false,
  size = "default",
  tone = "neutral",
  ...props
}: Readonly<Props>) {
  return (
    <AppBadge
      className={cn(TONES[tone], SIZES[size], className)}
      variant="outline"
      {...props}
    >
      {dot && (
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-current"
        />
      )}
      {children}
    </AppBadge>
  );
}
