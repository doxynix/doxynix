"use client";

import { Skeleton } from "@/shared/ui/core/skeleton";
import { SkeletonText } from "@/shared/ui/kit/app-skeleton";

export function NotificationCardSkeleton() {
  return (
    <div className="flex min-w-0 items-start gap-3 px-4 py-3.5">
      <Skeleton className="size-7 shrink-0 rounded-lg" />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <SkeletonText
          lines={1}
          widths={["w-64"]}
        />
        <SkeletonText
          lines={1}
          size="sm"
          widths={["w-40"]}
        />
      </div>

      <Skeleton className="h-3 w-20 shrink-0" />
      <Skeleton className="size-7 shrink-0 rounded-md" />
    </div>
  );
}
