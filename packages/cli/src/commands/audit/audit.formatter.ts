import { brand, pc } from "@/ui/colors";
import { formatDateTime } from "@/ui/formatters";
import { createTable } from "@/ui/table";

import type { AuditLogItem } from "./audit.types";

export function renderAuditTable(items: AuditLogItem[]): string {
  const table = createTable(["Log ID", "Timestamp", "Action / Event", "Target", "Details"]);

  for (const item of items) {
    const idLabel = item.id ? brand.muted(`${item.id.slice(0, 8)}...`) : "—";
    const actionLabel = brand.highlight(item.actionTitle);
    const target = item.targetName || item.entityType || "System";
    const date = formatDateTime(item.createdAt);
    const details = item.details?.map((d) => `${d.label}: ${d.value}`).join(", ") ?? "—";

    table.push([idLabel, brand.muted(date), actionLabel, pc.cyan(target), brand.muted(details)]);
  }

  return table.toString();
}
