"use client";

import { Skeleton } from "@/shared/ui/core/skeleton";

export function AdminBannedEmailsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton
          className="h-12 w-full"
          key={index}
        />
      ))}
    </div>
  );
}
