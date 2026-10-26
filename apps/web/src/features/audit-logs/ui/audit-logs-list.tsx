import { useTranslations } from "next-intl";

import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/shared/ui/core/table";

import type { UiAuditLog } from "@/entities/audit-log/model/audit-log.types";
import { AuditLogRow } from "@/entities/audit-log/ui/audit-log-row";

type Props = {
  logs: UiAuditLog[];
};

export function AuditLogList({ logs }: Readonly<Props>) {
  const t = useTranslations("AuditLogs");

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>{t("col_event")}</TableHead>
          <TableHead>{t("col_entity")}</TableHead>
          <TableHead>{t("col_target")}</TableHead>
          <TableHead>{t("col_source")}</TableHead>
          <TableHead className="text-right">{t("col_time")}</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <AuditLogRow
            key={log.id}
            log={log}
          />
        ))}
      </TableBody>
    </Table>
  );
}
