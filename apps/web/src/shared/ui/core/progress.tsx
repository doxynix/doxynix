"use client";

import type { ComponentProps, CSSProperties } from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/shared/lib/cn";

function Progress({
  className,
  indicatorClassName,
  indicatorStyle,
  value,
  ...props
}: ComponentProps<typeof ProgressPrimitive.Root> & {
  indicatorClassName?: string;
  indicatorStyle?: CSSProperties;
}) {
  const safe = Number.isFinite(value) ? (value as number) : 0;
  const percentage = Math.min(100, Math.max(0, safe));

  return (
    <ProgressPrimitive.Root
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      data-slot="progress"
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full w-full flex-1 transition-standard",
          indicatorClassName || "bg-primary",
        )}
        data-slot="progress-indicator"
        style={{
          transform: `translateX(-${100 - percentage}%)`,
          ...indicatorStyle,
        }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
