import { cn } from "@/shared/lib/utils";
import { Skeleton } from "@/shared/ui/core/skeleton";

export function RepoSetupSkeleton() {
  const levels = [0, 1, 2, 2, 1, 2, 2, 2, 0, 1, 1, 2, 1, 0, 0, 1, 2, 1, 0, 1];

  const widths = ["w-32", "w-48", "w-24", "w-40", "w-36", "w-20", "w-44", "w-28", "w-52", "w-32"];
  const SKELETON_STYLES = "h-4 w-4 shrink-0 rounded-full";

  return (
    <div className="h-145 w-full space-y-2 p-1">
      {levels.map((level, i) => (
        <div
          key={i}
          className="flex items-center gap-3 py-1"
          style={{ paddingLeft: `${level * 24}px` }}
        >
          <Skeleton className={SKELETON_STYLES} />

          <Skeleton className={SKELETON_STYLES} />

          <Skeleton className={SKELETON_STYLES} />

          <Skeleton className={cn("h-3.5 rounded-full", widths[i % widths.length])} />

          {i % 4 === 0 && <Skeleton className="ml-auto h-3 w-8 rounded-full" />}
        </div>
      ))}
    </div>
  );
}
