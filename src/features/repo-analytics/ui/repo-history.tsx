"use client";

import { useLocale } from "next-intl";

import type { UiRepoHistory } from "@/shared/api/trpc";
import { formatRelativeTime } from "@/shared/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/core/table";

type Props = {
  history: UiRepoHistory;
};

export function RepoHistory({ history }: Readonly<Props>) {
  const locale = useLocale();

  return (
    <div className="bg-card text-card-foreground rounded-lg border border-t">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Commit SHA</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Score</TableHead>
            <TableHead className="text-right">Analyzed at</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((h) => (
            <TableRow key={h.id} className="opacity-70 hover:opacity-100">
              <TableCell className="max-w-sm truncate font-mono text-xs">
                {h.commitSha?.substring(0, 7) ?? "—"}
              </TableCell>
              <TableCell className="text-xs font-medium tracking-wider uppercase">
                {h.status}
              </TableCell>
              <TableCell className="text-sm font-bold">
                {h.score !== null ? `${h.score}/100` : "—"}
              </TableCell>
              <TableCell className="textsm text-right">
                {formatRelativeTime(h.createdAt, locale)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
