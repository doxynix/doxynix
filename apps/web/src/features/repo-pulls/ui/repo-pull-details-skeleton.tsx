import { Card } from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { SkeletonText } from "@/shared/ui/kit/app-skeleton";

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
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <div className="px-6">
              <SkeletonText
                lines={1}
                size="xl"
                widths={["w-48"]}
              />
            </div>

            <div className="flex flex-col gap-3 px-6">
              <Skeleton className="h-8 w-64 rounded-lg" />

              {[0, 1, 2].map((row) => (
                <div
                  className="flex items-start gap-2.5 border-t pt-3"
                  key={row}
                >
                  <Skeleton className="size-5 shrink-0 rounded-full" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <SkeletonText
                      lines={1}
                      widths={["w-2/3"]}
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

          <Card>
            <div className="flex items-center justify-between px-6">
              <SkeletonText
                lines={1}
                size="xl"
                widths={["w-56"]}
              />
              <Skeleton className="h-8 w-40 rounded-lg" />
            </div>

            <div className="flex flex-col gap-4 px-6">
              {[0, 1, 2].map((row) => (
                <div
                  className="border-t pt-3 first:border-t-0 first:pt-0"
                  key={row}
                >
                  <SkeletonText
                    lines={1}
                    size="sm"
                    widths={["w-40"]}
                  />
                  <div className="mt-2">
                    <SkeletonText
                      lines={3}
                      widths={["w-full", "w-full", "w-2/3"]}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <div className="px-6">
              <SkeletonText
                lines={1}
                size="xl"
                widths={["w-40"]}
              />
            </div>

            <div className="flex flex-col gap-2 px-6">
              {[0, 1, 2, 3, 4].map((row) => (
                <div
                  className="flex items-center justify-between gap-3"
                  key={row}
                >
                  <SkeletonText
                    lines={1}
                    size="sm"
                    widths={["w-24"]}
                  />
                  <SkeletonText
                    lines={1}
                    size="sm"
                    widths={["w-16"]}
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="px-6">
              <SkeletonText
                lines={1}
                size="xl"
                widths={["w-40"]}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 px-6">
              {[0, 1, 2, 3].map((item) => (
                <div
                  className="flex flex-col gap-1"
                  key={item}
                >
                  <SkeletonText
                    lines={1}
                    size="sm"
                    widths={["w-20"]}
                  />
                  <SkeletonText
                    lines={1}
                    size="lg"
                    widths={["w-12"]}
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="px-6">
              <SkeletonText
                lines={1}
                size="xl"
                widths={["w-36"]}
              />
            </div>

            <div className="flex flex-col gap-3 px-6">
              {[0, 1].map((row) => (
                <div
                  className="flex flex-col gap-1.5 border-t pt-3 first:border-t-0 first:pt-0"
                  key={row}
                >
                  <div className="flex items-center justify-between gap-3">
                    <SkeletonText
                      lines={1}
                      widths={["w-40"]}
                    />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <SkeletonText
                    lines={2}
                    size="sm"
                    widths={["w-full", "w-3/4"]}
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
