"use client";

import { Card, CardAction, CardContent, CardHeader } from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { SkeletonList, SkeletonText } from "@/shared/ui/kit/app-skeleton";

export function TrendsWidgetsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <SkeletonText
            lines={1}
            size="lg"
            widths={["w-40"]}
          />
          <SkeletonText
            lines={1}
            size="sm"
            widths={["w-64"]}
          />
        </div>

        <CardAction>
          <Skeleton className="h-8 w-42 rounded-lg" />
        </CardAction>
      </CardHeader>

      <CardContent>
        <div className="relative h-75">
          <div className="absolute top-0 left-0 flex h-full w-8 flex-col justify-between py-2 text-2xs">
            <SkeletonList
              className="flex h-full flex-col justify-between"
              count={5}
              renderItem={() => (
                <SkeletonText
                  lines={1}
                  size="sm"
                  widths={["w-6"]}
                />
              )}
            />
          </div>

          <div className="ml-10 h-full overflow-hidden">
            <svg
              className="h-full w-full animate-pulse"
              preserveAspectRatio="none"
              viewBox="0 0 400 100"
            >
              <path
                className="text-foreground/10"
                d="M0 20 Q 100 15, 200 25 T 400 30 L 400 100 L 0 100 Z"
                fill="currentColor"
              />
              <path
                className="text-foreground/15"
                d="M0 50 Q 100 45, 200 55 T 400 50 L 400 100 L 0 100 Z"
                fill="currentColor"
              />

              <line
                className="text-muted/20"
                stroke="currentColor"
                strokeWidth="0.5"
                x1="0"
                x2="400"
                y1="25"
                y2="25"
              />
              <line
                className="text-muted/20"
                stroke="currentColor"
                strokeWidth="0.5"
                x1="0"
                x2="400"
                y1="50"
                y2="50"
              />
              <line
                className="text-muted/20"
                stroke="currentColor"
                strokeWidth="0.5"
                x1="0"
                x2="400"
                y1="75"
                y2="75"
              />
            </svg>
          </div>

          <div className="absolute bottom-0 left-10 right-0 flex justify-between">
            <SkeletonText
              lines={1}
              size="sm"
              widths={["w-12"]}
            />
            <SkeletonText
              lines={1}
              size="sm"
              widths={["w-12"]}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
