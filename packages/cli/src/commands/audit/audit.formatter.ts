import { brand, pc } from "@/ui/colors";
import { createTable } from "@/ui/table";

export function renderAuditTable(items: any[]): string {
  const table = createTable(["Timestamp", "Action / Event", "Resource Target", "Status / Details"]);

  for (const item of items) {
    const actionLabel = item.action ? brand.highlight(item.action) : brand.muted("EVENT");
    const target = item.target || item.model || "System";
    const date = item.createdAt ? new Date(item.createdAt).toLocaleString() : "Unknown";

    let details = item.description || "";
    if (!details && item.payload) {
      details = JSON.stringify(item.payload).slice(0, 40) + "...";
    }

    table.push([brand.muted(date), actionLabel, pc.cyan(target), brand.muted(details || "—")]);
  }

  return table.toString();
}
