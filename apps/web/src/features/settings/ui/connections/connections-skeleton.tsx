import { Skeleton } from "@/shared/ui/core/skeleton";
import { SkeletonList, SkeletonText } from "@/shared/ui/kit/app-skeleton";

export function ConnectionsSkeleton() {
  return (
    <div className="grid gap-10">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <SkeletonText
            lines={1}
            size="lg"
            widths={["w-48"]}
          />
          <SkeletonText
            lines={1}
            widths={["w-full"]}
          />
        </div>
        <SkeletonList
          className="flex flex-col gap-3"
          count={3}
          renderItem={() => <Skeleton className="h-[86px] w-full" />}
        />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <SkeletonText
            lines={1}
            size="lg"
            widths={["w-56"]}
          />
          <SkeletonText
            lines={1}
            widths={["w-full"]}
          />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-[86px] w-full" />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-1 flex-col gap-1.5">
            <SkeletonText
              lines={1}
              size="lg"
              widths={["w-48"]}
            />
            <SkeletonText
              lines={1}
              widths={["w-full"]}
            />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <Skeleton className="h-[86px] w-full" />
      </section>
    </div>
  );
}
