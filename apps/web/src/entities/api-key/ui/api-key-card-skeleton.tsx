import { Card } from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { SkeletonText } from "@/shared/ui/kit/app-skeleton";

export function ApiKeyCardSkeleton() {
  return (
    <Card size="row">
      <Skeleton className="size-9 shrink-0 rounded-lg" />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <SkeletonText
          lines={1}
          widths={["w-32"]}
        />
        <SkeletonText
          lines={1}
          size="sm"
          widths={["w-64"]}
        />
        <Skeleton className="h-8 w-full rounded-lg" />
      </div>

      <Skeleton className="h-8 w-20 shrink-0 rounded-lg" />
    </Card>
  );
}
