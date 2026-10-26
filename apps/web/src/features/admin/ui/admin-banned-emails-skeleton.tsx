"use client";

import { Skeleton } from "@/shared/ui/core/skeleton";
import type { SkeletonColumn } from "@/shared/ui/kit/app-skeleton";
import { SkeletonTable, SkeletonText } from "@/shared/ui/kit/app-skeleton";

const ROWS = 20;

const COLUMNS: SkeletonColumn[] = [
  {
    render: () => (
      <SkeletonText
        lines={1}
        widths={["w-48"]}
      />
    ),
    width: "w-24",
  },
  {
    render: () => (
      <SkeletonText
        lines={1}
        widths={["w-20"]}
      />
    ),
    width: "w-20",
  },
  {
    render: () => (
      <SkeletonText
        lines={1}
        widths={["w-28"]}
      />
    ),
    width: "w-24",
  },
  {
    className: "text-right",
    render: () => <Skeleton className="size-9 rounded-xl" />,
    width: "w-16",
  },
];

export function AdminBannedEmailsSkeleton() {
  return (
    <SkeletonTable
      columns={COLUMNS}
      rows={ROWS}
    />
  );
}
