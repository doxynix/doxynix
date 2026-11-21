"use client";

import { Card } from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { SkeletonText } from "@/shared/ui/kit/app-skeleton";

type Props = {
  variant?: "row" | "brief";
};

function RepoRowCardSkeleton() {
  return (
    <Card size="row">
      <Skeleton className="size-9 shrink-0 rounded-full" />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-2">
          <SkeletonText
            lines={1}
            widths={["w-40"]}
          />
          <Skeleton className="h-4 w-14 shrink-0 rounded-full" />
        </div>

        <SkeletonText
          lines={2}
          widths={["w-full", "w-3/4"]}
        />

        <div className="mt-1 flex flex-wrap gap-1">
          <SkeletonText
            lines={1}
            size="sm"
            widths={["w-14"]}
          />
          <SkeletonText
            lines={1}
            size="sm"
            widths={["w-14"]}
          />
          <SkeletonText
            lines={1}
            size="sm"
            widths={["w-14"]}
          />
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-2">
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

      <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-3 w-14 rounded-md" />
        </div>
        <Skeleton className="h-8 w-20 rounded-xl" />
        <div className="flex items-center gap-0.5">
          <Skeleton className="size-6 rounded" />
          <Skeleton className="size-6 rounded" />
        </div>
      </div>
    </Card>
  );
}

function RepoBriefCardSkeleton() {
  return (
    <Card className="gap-4">
      <div className="flex items-start gap-3 px-6">
        <Skeleton className="size-9 shrink-0 rounded-full" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <SkeletonText
              lines={1}
              widths={["w-40"]}
            />
            <Skeleton className="h-4 w-14 shrink-0 rounded-full" />
          </div>
          <div className="mt-1.5">
            <SkeletonText
              lines={1}
              size="sm"
              widths={["w-32"]}
            />
          </div>
        </div>

        <Skeleton className="h-4 w-16 shrink-0 rounded-full" />
      </div>

      <div className="px-6">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Skeleton className="h-4 w-16 rounded-md" />
            <Skeleton className="mt-1.5 h-7 w-14 rounded-md" />
          </div>
          <div>
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="mt-1.5 h-7 w-14 rounded-md" />
          </div>
        </div>
        <Skeleton className="mt-2.5 h-1.5 w-full rounded-full" />
      </div>

      <div className="flex items-center justify-end border-t px-6 pt-4">
        <Skeleton className="h-8 w-24 rounded-xl" />
      </div>
    </Card>
  );
}

export function RepoCardSkeleton({ variant = "row" }: Readonly<Props>) {
  if (variant === "brief") {
    return <RepoBriefCardSkeleton />;
  }

  return <RepoRowCardSkeleton />;
}
