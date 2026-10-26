import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";
import { Skeleton } from "@/shared/ui/core/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/core/table";

const TEXT_SIZE = {
  lg: { bar: "h-4", line: "h-6" },
  md: { bar: "h-3.5", line: "h-5" },
  sm: { bar: "h-3", line: "h-4" },
  xl: { bar: "h-6", line: "h-8" },
  xxl: { bar: "h-7", line: "h-9" },
} as const;

type SkeletonSize = keyof typeof TEXT_SIZE;

type SkeletonTextProps = {
  className?: string;
  lines?: number;
  size?: SkeletonSize;
  widths?: string[];
};

export function SkeletonText({
  className,
  lines = 2,
  size = "md",
  widths,
}: Readonly<SkeletonTextProps>) {
  return (
    <div
      aria-hidden="true"
      className={cn("flex min-w-0 flex-col", className)}
    >
      {Array.from({ length: lines }, (_, index) => (
        <div
          className={cn("flex items-center", TEXT_SIZE[size].line)}
          key={index}
        >
          <Skeleton
            className={cn(
              "min-w-0 max-w-full rounded-md",
              TEXT_SIZE[size].bar,
              widths?.[index % widths.length] ?? (index === lines - 1 ? "w-1/2" : "w-full"),
            )}
          />
        </div>
      ))}
    </div>
  );
}

export type SkeletonColumn = {
  className?: string;
  render?: () => ReactNode;
  width?: string;
};

type SkeletonTableProps = {
  columns: readonly SkeletonColumn[];
  rows?: number;
};

type SkeletonTableBodyProps = SkeletonTableProps;

export function SkeletonTableBody({ columns, rows = 8 }: Readonly<SkeletonTableBodyProps>) {
  return (
    <TableBody>
      {Array.from({ length: rows }, (_, row) => (
        <TableRow key={row}>
          {columns.map((column, index) => (
            <TableCell
              className={column.className}
              key={index}
            >
              {column.render?.()}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  );
}

export function SkeletonTable({ columns, rows = 8 }: Readonly<SkeletonTableProps>) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column, index) => (
            <TableHead
              className={column.className}
              key={index}
            >
              <SkeletonText
                lines={1}
                widths={[column.width ?? "w-16"]}
              />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <SkeletonTableBody
        columns={columns}
        rows={rows}
      />
    </Table>
  );
}

type SkeletonListProps = {
  className?: string;
  count: number;
  itemClassName?: string;
  renderItem: (index: number) => ReactNode;
};

export function SkeletonList({
  className,
  count,
  itemClassName,
  renderItem,
}: Readonly<SkeletonListProps>) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, index) => (
        <div
          className={itemClassName}
          key={index}
        >
          {renderItem(index)}
        </div>
      ))}
    </div>
  );
}
