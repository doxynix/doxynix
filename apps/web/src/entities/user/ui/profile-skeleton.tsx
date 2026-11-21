import { Card, CardContent } from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { SkeletonText } from "@/shared/ui/kit/app-skeleton";

export function ProfileSkeleton() {
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-4 px-6">
        <Skeleton className="size-14 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <SkeletonText
            lines={1}
            widths={["w-40"]}
          />
          <SkeletonText
            lines={1}
            size="sm"
            widths={["w-56"]}
          />
          <SkeletonText
            lines={1}
            size="sm"
            widths={["w-48"]}
          />
        </div>
        <Skeleton className="h-8 w-28 shrink-0 rounded-lg" />
        <Skeleton className="size-8 shrink-0 rounded-lg" />
      </div>

      <CardContent className="border-t pt-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <SkeletonText
              lines={1}
              size="sm"
              widths={["w-24"]}
            />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
          <div className="flex flex-col gap-2">
            <SkeletonText
              lines={1}
              size="sm"
              widths={["w-24"]}
            />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}
