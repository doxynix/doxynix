import type { ComponentProps } from "react";

import { cn } from "@/shared/lib/cn";

function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-skeleton-pulse rounded-xl bg-skeleton", className)}
      data-slot="skeleton"
      {...props}
    />
  );
}

export { Skeleton };
