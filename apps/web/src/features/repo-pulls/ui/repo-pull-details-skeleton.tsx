import { Card } from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { SkeletonList, SkeletonText } from "@/shared/ui/kit/app-skeleton";

export function RepoPullDetailsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div className="flex flex-col gap-2">
          <SkeletonText
            lines={1}
            size="xxl"
            widths={["w-56"]}
          />
          <div className="flex items-center gap-1">
            <SkeletonText
              lines={1}
              size="lg"
              widths={["w-24"]}
            />
            <Skeleton className="size-6 rounded-md" />
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <SkeletonText
            lines={1}
            widths={["w-24"]}
          />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <SkeletonList
          className="flex flex-col gap-6 lg:col-span-2"
          count={4}
          renderItem={() => (
            <Card>
              <div className="px-6">
                <SkeletonText
                  lines={1}
                  size="xl"
                  widths={["w-48"]}
                />
              </div>
              <div className="flex flex-col gap-3 px-6">
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            </Card>
          )}
        />
        <SkeletonList
          className="flex flex-col gap-6"
          count={3}
          renderItem={() => (
            <Card>
              <div className="px-6">
                <SkeletonText
                  lines={1}
                  size="xl"
                  widths={["w-40"]}
                />
              </div>
              <div className="flex flex-col gap-3 px-6">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            </Card>
          )}
        />
      </div>
    </div>
  );
}
