import type { ReactNode } from "react";

import { Card } from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { SkeletonText } from "@/shared/ui/kit/app-skeleton";

function MetricSkeleton() {
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
          <Skeleton className="mt-1 h-8 w-24" />
        </div>
        <Skeleton className="size-7 shrink-0 rounded-lg" />
      </div>

      <Skeleton className="h-1 w-full rounded-full" />

      <SkeletonText
        lines={1}
        size="sm"
        widths={["w-32"]}
      />
    </Card>
  );
}

function RowsSkeleton({ rows }: Readonly<{ rows: number }>) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, index) => (
        <div
          className="flex items-center justify-between gap-3"
          key={index}
        >
          <SkeletonText
            lines={1}
            size="sm"
            widths={["w-24"]}
          />
          <SkeletonText
            lines={1}
            size="sm"
            widths={["w-8"]}
          />
        </div>
      ))}
    </div>
  );
}

function SectionCard({
  children,
  rows,
  titleWidth = "w-40",
}: Readonly<{ children?: ReactNode; rows?: number; titleWidth?: string }>) {
  return (
    <Card>
      <div className="px-6">
        <SkeletonText
          lines={1}
          size="lg"
          widths={[titleWidth]}
        />
      </div>

      <div className="px-6">{children ?? (rows != null ? <RowsSkeleton rows={rows} /> : null)}</div>
    </Card>
  );
}

export function RepoOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <SectionCard>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <SkeletonText
                  lines={1}
                  size="sm"
                  widths={["w-28"]}
                />
                <SkeletonText
                  lines={1}
                  size="xxl"
                  widths={["w-56"]}
                />
                <SkeletonText
                  lines={2}
                  widths={["w-full", "w-4/5"]}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {["w-20", "w-16", "w-24", "w-20"].map((width) => (
                  <Skeleton
                    className={`h-6 rounded-full ${width}`}
                    key={width}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between gap-2 border-t pt-4">
                <SkeletonText
                  lines={1}
                  size="sm"
                  widths={["w-32"]}
                />
                <SkeletonText
                  lines={1}
                  size="sm"
                  widths={["w-40"]}
                />
              </div>
            </div>
          </SectionCard>

          <Card
            className="gap-3 px-6 py-4"
            size="compact"
          >
            <SkeletonText
              lines={1}
              size="sm"
              widths={["w-44"]}
            />
            <Skeleton className="h-9 w-full" />
          </Card>
        </div>

        <SectionCard titleWidth="w-36">
          <div className="flex flex-col gap-4">
            {[0, 1].map((group) => (
              <div
                className="flex flex-col gap-2"
                key={group}
              >
                <SkeletonText
                  lines={1}
                  size="sm"
                  widths={["w-24"]}
                />

                {[0, 1, 2].map((row) => (
                  <div
                    className="flex items-center gap-2.5"
                    key={row}
                  >
                    <Skeleton className="size-7 shrink-0 rounded-md" />
                    <SkeletonText
                      lines={1}
                      widths={["w-40"]}
                    />
                    <SkeletonText
                      className="ml-auto"
                      lines={1}
                      size="sm"
                      widths={["w-10"]}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((item) => (
          <MetricSkeleton key={item} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SectionCard titleWidth="w-40">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {[0, 1, 2, 3].map((item) => (
              <div
                className="flex flex-col gap-1"
                key={item}
              >
                <SkeletonText
                  lines={1}
                  size="sm"
                  widths={["w-16"]}
                />
                <SkeletonText
                  lines={1}
                  size="lg"
                  widths={["w-12"]}
                />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard titleWidth="w-32">
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div
                className="flex flex-col gap-1"
                key={item}
              >
                <SkeletonText
                  lines={1}
                  size="sm"
                  widths={["w-16"]}
                />
                <SkeletonText
                  lines={1}
                  size="lg"
                  widths={["w-10"]}
                />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard titleWidth="w-24">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-2 w-full rounded-full" />

            {[0, 1, 2, 3].map((item) => (
              <div
                className="flex items-center gap-2"
                key={item}
              >
                <Skeleton className="size-2 shrink-0 rounded-sm" />
                <SkeletonText
                  lines={1}
                  size="sm"
                  widths={["w-24"]}
                />
                <SkeletonText
                  className="ml-auto"
                  lines={1}
                  size="sm"
                  widths={["w-8"]}
                />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard titleWidth="w-28">
          <RowsSkeleton rows={5} />
        </SectionCard>

        <Card className="lg:col-span-2">
          <div className="px-6">
            <SkeletonText
              lines={1}
              size="lg"
              widths={["w-36"]}
            />
          </div>

          <div className="flex flex-col gap-4 px-6">
            <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((item) => (
                <SkeletonText
                  key={item}
                  lines={1}
                  size="sm"
                  widths={["w-full"]}
                />
              ))}
            </div>

            <div className="flex flex-col gap-2 border-t pt-3">
              <div className="flex flex-wrap gap-1.5">
                {["w-16", "w-20", "w-14"].map((width) => (
                  <Skeleton
                    className={`h-5 rounded-full ${width}`}
                    key={width}
                  />
                ))}
              </div>
              <SkeletonText
                lines={2}
                widths={["w-full", "w-3/4"]}
              />
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex flex-col gap-2 px-6">
            <SkeletonText
              lines={1}
              size="lg"
              widths={["w-40"]}
            />
            <SkeletonText
              lines={1}
              size="sm"
              widths={["w-32"]}
            />
          </div>

          <div className="grid grid-cols-1 gap-x-4 px-6 sm:grid-cols-2">
            {[0, 1, 2, 3].map((item) => (
              <div
                className="flex items-center gap-2.5 py-2"
                key={item}
              >
                <Skeleton className="size-7 shrink-0 rounded-md" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <SkeletonText
                    lines={1}
                    size="sm"
                    widths={["w-28"]}
                  />
                  <SkeletonText
                    lines={1}
                    size="sm"
                    widths={["w-36"]}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="px-6">
            <SkeletonText
              lines={1}
              size="lg"
              widths={["w-32"]}
            />
          </div>

          <div className="flex flex-col gap-1 px-6">
            {[0, 1, 2, 3, 4].map((item) => (
              <div
                className="flex items-center gap-2.5 py-1.5"
                key={item}
              >
                <SkeletonText
                  lines={1}
                  size="sm"
                  widths={["w-4"]}
                />
                <Skeleton className="size-3.5 shrink-0 rounded" />
                <SkeletonText
                  lines={1}
                  widths={["w-3/4"]}
                />
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="px-6">
            <SkeletonText
              lines={1}
              size="lg"
              widths={["w-28"]}
            />
          </div>

          <div className="flex flex-col gap-4 px-6">
            {[0, 1, 2].map((item) => (
              <div
                className="flex flex-col gap-1.5"
                key={item}
              >
                <div className="flex items-start justify-between gap-3">
                  <SkeletonText
                    lines={1}
                    widths={["w-40"]}
                  />
                  <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
                </div>
                <SkeletonText
                  lines={1}
                  size="sm"
                  widths={["w-full"]}
                />
              </div>
            ))}
          </div>
        </Card>

        <Card className="col-span-1 md:col-span-2 lg:col-span-4">
          <div className="px-6">
            <SkeletonText
              lines={1}
              size="xxl"
              widths={["w-40"]}
            />
          </div>
          <div className="px-6">
            <Skeleton className="h-75 w-full" />
          </div>
        </Card>
      </div>
    </div>
  );
}
