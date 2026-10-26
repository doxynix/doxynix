"use client";

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
        widths={["w-24"]}
      />
    ),
    width: "w-16",
  },
  {
    render: () => (
      <SkeletonText
        lines={1}
        widths={["w-12"]}
      />
    ),
    width: "w-12",
  },
  {
    render: () => (
      <SkeletonText
        lines={1}
        widths={["w-16"]}
      />
    ),
    width: "w-12",
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
];

export function AdminReviewSkeleton() {
  return (
    <SkeletonTable
      columns={COLUMNS}
      rows={ROWS}
    />
  );
}
