import { Skeleton } from "@/shared/ui/core/skeleton";
import { SkeletonText } from "@/shared/ui/kit/app-skeleton";

import { RepoMapSidebarSkeleton } from "./repo-map-sidebar-skeleton";

export function RepoMapSkeleton() {
  return (
    <div className="relative flex h-[calc(100dvh-260px)] w-full flex-col overflow-hidden rounded-xl border">
      <div className="flex shrink-0 items-center justify-between p-3">
        <div className="flex items-center gap-1.5">
          <SkeletonText
            lines={1}
            size="lg"
            widths={["w-12"]}
          />
          <Skeleton className="size-3" />
          <SkeletonText
            lines={1}
            size="lg"
            widths={["w-20"]}
          />
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        <div className="relative h-full min-h-0 w-[70%]">
          <Skeleton className="absolute inset-0 rounded-none" />
        </div>

        <div className="h-full min-h-0 w-[30%] border-l">
          <RepoMapSidebarSkeleton />
        </div>
      </div>
    </div>
  );
}
