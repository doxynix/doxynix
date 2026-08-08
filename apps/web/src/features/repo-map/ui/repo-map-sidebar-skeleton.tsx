import { Skeleton } from "@/shared/ui/core/skeleton";

export function RepoMapSidebarSkeleton() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-12" />
        <Skeleton className="h-24" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
