"use client";

import { Card, CardContent } from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { SkeletonText } from "@/shared/ui/kit/app-skeleton";

export function RepoCardSkeleton() {
  return (
    <Card className="relative flex overflow-hidden p-4">
      <CardContent className="flex w-full justify-center gap-4 md:justify-between">
        <div className="flex min-w-0 flex-wrap gap-2 sm:flex-nowrap">
          <Skeleton className="size-9 shrink-0 rounded-full" />

          <div className="flex min-w-0 flex-1 flex-col justify-between gap-1">
            <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <SkeletonText
                  lines={1}
                  widths={["w-40"]}
                />
                <SkeletonText
                  lines={1}
                  widths={["w-16"]}
                />
              </div>
            </div>

            <SkeletonText
              lines={2}
              widths={["w-full", "w-3/4"]}
            />

            <div className="mt-1 flex flex-wrap gap-1">
              <SkeletonText
                lines={1}
                widths={["w-16"]}
              />
              <SkeletonText
                lines={1}
                widths={["w-16"]}
              />
              <SkeletonText
                lines={1}
                widths={["w-16"]}
              />
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-3">
              <SkeletonText
                lines={1}
                size="sm"
                widths={["w-10"]}
              />
              <SkeletonText
                lines={1}
                size="sm"
                widths={["w-10"]}
              />
              <SkeletonText
                lines={1}
                size="sm"
                widths={["w-12"]}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between not-sm:gap-2 sm:flex-col md:items-end">
          <div className="flex items-center gap-4">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="size-8 rounded-full" />
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <SkeletonText
              lines={1}
              widths={["w-20"]}
            />
            <SkeletonText
              lines={1}
              size="sm"
              widths={["w-24"]}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
