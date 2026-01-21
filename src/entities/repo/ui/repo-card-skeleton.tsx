import { Card, CardContent } from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";

type Props = {
  count?: number;
};

export function RepoCardSkeleton({ count }: Props) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count ?? 4 }).map((_, i) => (
        <Card key={i} className="relative overflow-hidden p-4">
          <div className="absolute top-4 right-4 flex gap-2 opacity-100 transition-opacity">
            <Skeleton className="h-6 w-6 rounded" />
            <Skeleton className="h-6 w-6 rounded" />
          </div>

          <div className="absolute top-4 right-4 flex gap-1 text-xs">
            <Skeleton className="h-6 w-6" />
            <Skeleton className="h-6 w-6" />
          </div>

          <div className="absolute right-4 bottom-4 flex flex-col items-end text-xs">
            <div className="flex items-center gap-1 rounded px-2 py-0.5">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="mt-1 h-3 w-30" />
          </div>

          <CardContent className="flex gap-2">
            <Skeleton className="h-19.5 w-19.5 rounded-xl" />

            <div className="flex w-full flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2 truncate">
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-44" />
                  </div>

                  <Skeleton className="h-4 w-4 shrink-0 rounded" />
                </div>
              </div>

              <Skeleton className="mt-2 h-4 w-4/5" />

              <div className="mt-2 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1">
                  <Skeleton className="h-2.5 w-2.5 rounded-full" />
                  <Skeleton className="h-3 w-14" />
                </div>

                {Array.from({ length: 9 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-1">
                    <Skeleton className="h-3 w-3 rounded" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
