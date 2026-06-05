"use client";

import { Card, CardContent } from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";

export function RepoCardSkeleton() {
  return (
    <Card className="relative flex overflow-hidden p-4">
      <CardContent className="flex w-full justify-center gap-4 md:justify-between">
        <div className="flex min-w-0 flex-wrap gap-2 sm:flex-nowrap">
          <Skeleton className="size-9 shrink-0 rounded-full" />

          <div className="flex flex-1 flex-col justify-between gap-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>

            <div className="flex flex-col gap-1.5 py-1">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>

            <div className="flex flex-wrap gap-1.5 py-1">
              <Skeleton className="h-5 w-12 rounded-md" />
              <Skeleton className="h-5 w-16 rounded-md" />
              <Skeleton className="h-5 w-14 rounded-md" />
            </div>

            <div className="mt-1 flex items-center gap-3">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between sm:flex-col md:items-end">
          <div className="flex items-center gap-4">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="size-8 rounded-full" />
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
