"use client";

import { Skeleton } from "@/shared/ui/core/skeleton";
import type { SkeletonColumn } from "@/shared/ui/kit/app-skeleton";
import { SkeletonTable, SkeletonText } from "@/shared/ui/kit/app-skeleton";

const ROWS = 20;

const COLUMNS: SkeletonColumn[] = [
  {
    render: () => (
      <div className="flex items-center gap-3">
        <Skeleton className="rounded-lg size-8" />
        <SkeletonText
          lines={1}
          widths={["w-32"]}
        />
      </div>
    ),
    width: "w-16",
  },
  {
    render: () => (
      <SkeletonText
        lines={1}
        widths={["w-24"]}
      />
    ),
    width: "w-20",
  },
  {
    render: () => (
      <div>
        <SkeletonText
          lines={1}
          widths={["w-48"]}
        />
        <SkeletonText
          className="mt-1.5"
          lines={1}
          size="sm"
          widths={["w-32"]}
        />
      </div>
    ),
    width: "w-16",
  },
  {
    render: () => (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Skeleton className="size-5" />
          <SkeletonText
            lines={1}
            size="sm"
            widths={["w-24"]}
          />
        </div>
        <SkeletonText
          lines={1}
          size="sm"
          widths={["w-32"]}
        />
      </div>
    ),
    width: "w-16",
  },
  {
    className: "text-right whitespace-nowrap",
    render: () => (
      <SkeletonText
        lines={1}
        size="sm"
        widths={["w-16"]}
      />
    ),
    width: "w-20",
  },
  {
    className: "text-center",
    render: () => <Skeleton className="rounded-xl size-9" />,
    width: "w-12",
  },
];

export function AdminAuditSkeleton() {
  return (
    <SkeletonTable
      columns={COLUMNS}
      rows={ROWS}
    />
  );
}
