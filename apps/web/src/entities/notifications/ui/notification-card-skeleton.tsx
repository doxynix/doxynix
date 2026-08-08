"use client";

import { Card, CardContent } from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";

export function NotificationCardSkeleton() {
  return (
    <Card className="relative border-l-4">
      <CardContent className="flex items-end justify-between">
        <div className="flex gap-4">
          <div className="flex items-center gap-4">
            <Skeleton className="size-5" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-96" />
            </div>
          </div>
        </div>
        <Skeleton className="h-4 w-24" />
      </CardContent>
    </Card>
  );
}
