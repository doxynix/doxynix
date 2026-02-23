"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/shared/lib/utils";

function Progress({
  className,
  indicatorClassName,
  indicatorStyle,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indicatorClassName?: string;
  indicatorStyle?: React.CSSProperties;
}) {
  const safe = Number.isFinite(value) ? (value as number) : 0;
  const percentage = Math.min(100, Math.max(0, safe));

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn("bg-muted relative h-2 w-full overflow-hidden rounded-full", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn("h-full w-full flex-1 transition-all", indicatorClassName || "bg-primary")}
        style={{
          transform: `translateX(-${100 - percentage}%)`,
          ...indicatorStyle,
        }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
