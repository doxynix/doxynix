import { Card } from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { SkeletonText } from "@/shared/ui/kit/app-skeleton";

const LANGUAGE_FILLS = ["w-24", "w-16", "w-20", "w-14"];

function WidgetHeaderSkeleton({ badge = false }: Readonly<{ badge?: boolean }>) {
  return (
    <div className="flex items-center gap-2.5">
      <Skeleton className="size-8 shrink-0 rounded-lg" />

      <div className="flex min-w-0 flex-1 flex-col">
        <SkeletonText
          lines={1}
          widths={["w-32"]}
        />
      </div>

      {badge && <Skeleton className="h-5 w-20 shrink-0 rounded-full" />}
    </div>
  );
}

export function LanguagesSkeleton() {
  return (
    <Card
      className="gap-3"
      size="compact"
    >
      <WidgetHeaderSkeleton badge={true} />

      <Skeleton className="h-2 w-full rounded-full" />

      <div className="flex flex-col divide-y divide-border">
        {LANGUAGE_FILLS.map((width) => (
          <div
            className="flex items-center gap-2 py-2"
            key={width}
          >
            <Skeleton className="size-2 shrink-0 rounded-sm" />
            <SkeletonText
              lines={1}
              size="sm"
              widths={[width]}
            />
            <Skeleton className="ml-auto h-3 w-8 shrink-0 rounded-md" />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function HealthExtremesSkeleton() {
  return (
    <Card
      className="gap-3"
      size="compact"
    >
      <WidgetHeaderSkeleton />

      <div className="flex flex-col divide-y divide-border">
        {[0, 1].map((row) => (
          <div
            className="flex items-center gap-2.5 py-2.5"
            key={row}
          >
            <Skeleton className="size-1.5 shrink-0 rounded-full" />
            <SkeletonText
              lines={1}
              widths={["w-32"]}
            />
            <SkeletonText
              className="ml-auto items-end"
              lines={1}
              widths={["w-8"]}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function EcosystemStatusSkeleton() {
  return (
    <Card
      className="gap-3"
      size="compact"
    >
      <WidgetHeaderSkeleton badge={true} />

      <Skeleton className="h-56 w-full rounded-xl" />

      <div className="flex flex-col divide-y divide-border">
        {[0, 1, 2].map((row) => (
          <div
            className="flex items-center justify-between gap-3 py-2"
            key={row}
          >
            <SkeletonText
              lines={1}
              size="sm"
              widths={["w-24"]}
            />
            <SkeletonText
              className="items-end"
              lines={1}
              size="sm"
              widths={["w-10"]}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function RefactoringTargetsSkeleton() {
  return (
    <Card
      className="gap-4"
      size="compact"
    >
      <WidgetHeaderSkeleton />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[0, 1].map((column) => (
          <div
            className="flex flex-col gap-2"
            key={column}
          >
            <SkeletonText
              lines={1}
              size="sm"
              widths={["w-28"]}
            />

            {[0, 1, 2].map((row) => (
              <div
                className="flex items-center gap-2 py-1"
                key={row}
              >
                <Skeleton className="size-3.5 shrink-0 rounded" />
                <SkeletonText
                  lines={1}
                  widths={["w-32"]}
                />
                <Skeleton className="ml-auto h-5 w-12 shrink-0 rounded-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function RecentActivitySkeleton() {
  return (
    <Card
      className="gap-3"
      size="compact"
    >
      <WidgetHeaderSkeleton />

      <div className="flex flex-col divide-y divide-border">
        {[0, 1, 2, 3, 4].map((row) => (
          <div
            className="flex items-start gap-2.5 py-2.5"
            key={row}
          >
            <Skeleton className="mt-0.5 size-4 shrink-0 rounded-full" />

            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <SkeletonText
                lines={1}
                widths={["w-3/4"]}
              />
              <SkeletonText
                lines={1}
                size="sm"
                widths={["w-1/2"]}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function SystemRisksSkeleton() {
  return (
    <Card
      className="gap-3"
      size="compact"
    >
      <WidgetHeaderSkeleton />

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Skeleton className="size-1.5 shrink-0 rounded-full" />
          <SkeletonText
            lines={1}
            widths={["w-36"]}
          />
          <Skeleton className="ml-auto h-5 w-24 shrink-0 rounded-full" />
        </div>

        <div className="pl-3.5">
          <SkeletonText
            lines={2}
            size="sm"
            widths={["w-full", "w-2/3"]}
          />
        </div>
      </div>
    </Card>
  );
}
