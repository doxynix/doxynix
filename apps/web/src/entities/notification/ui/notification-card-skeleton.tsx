"use client";

import { Card, CardContent } from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { SkeletonText } from "@/shared/ui/kit/app-skeleton";

export function NotificationCardSkeleton() {
  return (
    <Card className="relative border-l-4 p-4">
      <CardContent className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Skeleton className="size-5 rounded-md" />
          <Skeleton className="size-2 shrink-0 rounded-full" />
          <SkeletonText
            className="min-w-0 flex-1"
            lines={1}
            widths={["w-48"]}
          />
          <SkeletonText
            className="min-w-0 flex-1"
            lines={1}
            size="sm"
            widths={["w-96"]}
          />
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <Skeleton className="size-6 rounded-md" />
          <SkeletonText
            lines={1}
            size="sm"
            widths={["w-24"]}
          />
        </div>
      </CardContent>
    </Card>
  );
}
