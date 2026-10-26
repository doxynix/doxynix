import { SkeletonList, SkeletonText } from "@/shared/ui/kit/app-skeleton";

export function AnalyticsChartSkeleton() {
  return (
    <div className="flex aspect-video max-h-75 w-full flex-col justify-between p-3">
      <SkeletonList
        className="flex flex-1 flex-col justify-between py-2"
        count={4}
        itemClassName="flex items-center gap-4"
        renderItem={() => (
          <>
            <SkeletonText
              lines={1}
              size="sm"
              widths={["w-6"]}
            />
            <div className="h-px flex-1 bg-border" />
          </>
        )}
      />
      <SkeletonList
        className="flex justify-between"
        count={6}
        renderItem={() => (
          <SkeletonText
            lines={1}
            size="sm"
            widths={["w-8"]}
          />
        )}
      />
    </div>
  );
}
