import { CircleOff } from "lucide-react";

import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/shared/ui/core/table";
import { EmptyState } from "@/shared/ui/kit/empty-state";

import type { UiAuditLog } from "@/entities/audit-log/model/audit-log.types";
import { AuditLogRow } from "@/entities/audit-log/ui/audit-log-row";

type Props = {
  logs: UiAuditLog[];
};

export function AuditLogList({ logs }: Readonly<Props>) {
  if (logs.length === 0) {
    return (
      <EmptyState
        description={"Start using Doxynix to see your activity"}
        icon={CircleOff}
        title={"No activity records found"}
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Event</TableHead>
          <TableHead>Entity</TableHead>
          <TableHead>Target</TableHead>
          <TableHead>Source</TableHead>
          <TableHead className="text-right">Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <AuditLogRow key={log.id} log={log} />
        ))}
      </TableBody>
    </Table>
  );
}
