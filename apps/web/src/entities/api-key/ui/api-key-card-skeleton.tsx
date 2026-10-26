import { Card, CardContent, CardHeader } from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { SkeletonText } from "@/shared/ui/kit/app-skeleton";

export function ApiKeyCardSkeleton() {
  return (
    <Card className="justify-between">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="flex w-full max-w-[70%] flex-col gap-1 overflow-hidden">
          <SkeletonText
            lines={1}
            widths={["w-32"]}
          />

          <SkeletonText
            lines={3}
            size="sm"
            widths={["w-2/3", "w-1/2", "w-3/5"]}
          />

          <SkeletonText
            className="mt-1"
            lines={1}
            widths={["w-24"]}
          />
        </div>

        <Skeleton className="size-9 rounded-xl" />
      </CardHeader>

      <CardContent>
        <Skeleton className="h-9 w-full rounded-xl" />
      </CardContent>
    </Card>
  );
}
