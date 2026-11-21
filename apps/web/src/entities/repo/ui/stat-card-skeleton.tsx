import { Card } from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { SkeletonText } from "@/shared/ui/kit/app-skeleton";

export function StatCardSkeleton() {
  return (
    <Card
      className="gap-2.5"
      size="compact"
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <SkeletonText
            lines={1}
            size="sm"
            widths={["w-24"]}
          />
          <div className="mt-1 flex items-center gap-2">
            <SkeletonText
              lines={1}
              size="xl"
              widths={["w-16"]}
            />
            <Skeleton className="h-4 w-10 rounded-full" />
          </div>
        </div>
        <Skeleton className="size-7 shrink-0 rounded-lg" />
      </div>

      <SkeletonText
        lines={1}
        size="sm"
        widths={["w-32"]}
      />
    </Card>
  );
}
