"use client";

import { Skeleton } from "@/shared/ui/core/skeleton";
import type { SkeletonColumn } from "@/shared/ui/kit/app-skeleton";
import { SkeletonTable, SkeletonText } from "@/shared/ui/kit/app-skeleton";

const ROWS = 20;

const COLUMNS: SkeletonColumn[] = [
  {
    render: () => (
      <div>
        <SkeletonText
          lines={1}
          widths={["w-40"]}
        />
        <SkeletonText
          className="mt-1.5"
          lines={1}
          size="sm"
          widths={["w-56"]}
        />
      </div>
    ),
    width: "w-16",
  },
  {
    render: () => (
      <SkeletonText
        lines={1}
        widths={["w-16"]}
      />
    ),
    width: "w-16",
  },
  {
    render: () => (
      <SkeletonText
        lines={1}
        widths={["w-20"]}
      />
    ),
    width: "w-16",
  },
  {
    render: () => (
      <SkeletonText
        lines={1}
        widths={["w-28"]}
      />
    ),
    width: "w-16",
  },
  {
    className: "text-right",
    render: () => <Skeleton className="size-9 rounded-xl" />,
    width: "w-16",
  },
];

export function AdminUsersSkeleton() {
  return (
    <SkeletonTable
      columns={COLUMNS}
      rows={ROWS}
    />
  );
}
