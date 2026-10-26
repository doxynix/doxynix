import { Skeleton } from "@/shared/ui/core/skeleton";
import { SkeletonText } from "@/shared/ui/kit/app-skeleton";

export function RepoMapSidebarSkeleton() {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
      <SkeletonText
        lines={1}
        size="xxl"
        widths={["w-64"]}
      />

      <div className="flex items-center gap-2">
        <SkeletonText
          lines={1}
          widths={["w-24"]}
        />
        <SkeletonText
          lines={1}
          widths={["w-20"]}
        />
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 rounded-xl border p-4">
          <div className="flex items-center gap-1">
            <Skeleton className="size-4" />
            <SkeletonText
              lines={1}
              widths={["w-28"]}
            />
          </div>
          <SkeletonText
            lines={1}
            size="lg"
            widths={["w-48"]}
          />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Skeleton className="size-4" />
            <SkeletonText
              lines={1}
              widths={["w-24"]}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Skeleton className="size-4" />
            <SkeletonText
              lines={1}
              widths={["w-32"]}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <SkeletonText
            lines={1}
            widths={["w-20"]}
          />
          <div className="italic rounded-xl border p-4">
            <SkeletonText
              lines={1}
              widths={["w-64"]}
            />
            <SkeletonText
              lines={1}
              widths={["w-48"]}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Skeleton className="size-4" />
            <SkeletonText
              lines={1}
              widths={["w-24"]}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
