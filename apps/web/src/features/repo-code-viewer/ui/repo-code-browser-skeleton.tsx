import { Skeleton } from "@/shared/ui/core/skeleton";
import { SkeletonText } from "@/shared/ui/kit/app-skeleton";

import { CodeSkeleton } from "./repo-code-skeleton";

export function RepoCodeBrowserSkeleton() {
  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex flex-col justify-between gap-4 border-border border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <Skeleton className="size-4" />
          <SkeletonText
            lines={1}
            size="sm"
            widths={["w-40"]}
          />
          <Skeleton className="size-6 rounded-xl" />
        </div>

        <div className="flex items-center justify-end gap-2">
          <Skeleton className="size-8 rounded-xl" />
          <Skeleton className="size-8 rounded-xl" />
          <Skeleton className="size-8 rounded-xl" />
          <Skeleton className="size-8 rounded-xl" />
          <Skeleton className="size-8 rounded-xl" />
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <CodeSkeleton />
      </div>

      <div className="flex items-center justify-between bg-card px-3 py-1.5">
        <SkeletonText
          lines={1}
          size="sm"
          widths={["w-24"]}
        />
        <SkeletonText
          lines={1}
          size="sm"
          widths={["w-32"]}
        />
      </div>
    </div>
  );
}
