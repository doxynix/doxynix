import { Card, CardContent, CardHeader } from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { SkeletonText } from "@/shared/ui/kit/app-skeleton";

export function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <SkeletonText
          lines={1}
          widths={["w-24"]}
        />
        <div className="flex size-10 items-center justify-center">
          <Skeleton className="size-6 rounded-full" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <SkeletonText
            lines={1}
            size="xl"
            widths={["w-20"]}
          />
          <Skeleton className="h-5 w-16 rounded-xl" />
        </div>
        <div className="mt-1">
          <SkeletonText
            lines={1}
            size="sm"
            widths={["w-32"]}
          />
        </div>
      </CardContent>
    </Card>
  );
}
