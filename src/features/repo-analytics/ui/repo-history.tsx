"use client";

import { useLocale } from "next-intl";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/core/table";
import { TimeAgo } from "@/shared/ui/kit/time-ago";

import type { UiRepoHistory } from "@/entities/repo/model/repo.types";

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
                {h.commitSha?.slice(0, 7) ?? "—"}
              </TableCell>
              <TableCell className="text-xs font-medium tracking-wider uppercase">
                {h.status}
              </TableCell>
              <TableCell className="text-sm font-bold">
                {h.score !== null ? `${h.score}/100` : "—"}
              </TableCell>
              <TableCell className="textsm text-right">
                <TimeAgo date={h.createdAt} locale={locale} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
