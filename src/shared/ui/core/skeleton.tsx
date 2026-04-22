import type { ComponentProps } from "react";

import { cn } from "@/shared/lib/cn";

function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-skeleton animate-skeleton-pulse rounded-xl", className)}
      {...props}
    />
  );
}

export { Skeleton };
