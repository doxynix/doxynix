"use client";

import { Card, CardContent } from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";

export function NotificationCardSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="relative border-l-4">
          <CardContent className="flex items-end justify-between">
            <div className="flex gap-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-2 w-2" />
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-96" />
                </div>
              </div>
              <Skeleton className="h-4 w-4" />

              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-4" />
            </div>
            <Skeleton className="h-4 w-24" />
          </CardContent>
        </Card>
      ))}
    </>
  );
}
