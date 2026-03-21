"use client";

import { Card } from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";

export function RepoCardSkeleton() {
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex w-full gap-4">
          <Skeleton className="size-10 shrink-0 rounded-full" />

          <div className="flex w-full max-w-[80%] flex-col gap-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-16" />
            </div>

            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>

            <div className="mt-1 flex gap-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-14" />
              <Skeleton className="h-6 w-24" />
            </div>

            <div className="mt-2 flex items-center gap-4">
              <div className="flex gap-2">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-3 w-12" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end justify-between self-stretch">
          <Skeleton className="h-3 w-24" />

          <div className="flex flex-col items-end gap-3">
            <Skeleton className="h-5 w-10" />
          </div>
        </div>
      </div>
    </Card>
  );
}
