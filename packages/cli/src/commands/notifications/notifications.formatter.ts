import type { RouterOutput } from "@/core/client";

import { brand } from "@/ui/colors";
import { createTable } from "@/ui/table";

export type NotificationItem = RouterOutput["notification"]["getAll"]["items"][number];

export function formatNotificationType(type: string): string {
  switch (type) {
    case "ERROR": {
      return brand.error("● Error");
    }
    case "WARNING": {
      return brand.warning("▲ Warning");
    }
    case "SUCCESS": {
      return brand.success("✔ Success");
    }
    default: {
      return brand.info("ℹ Info");
    }
  }
}

export function renderNotificationsTable(items: NotificationItem[]): string {
  const table = createTable(["ID", "Type", "Title", "Repository", "Created"]);

  for (const n of items) {
    table.push([
      brand.muted(`${n.id.slice(0, 8)}...`),
      formatNotificationType(n.type),
      brand.highlight(n.title),
      n.repo ? brand.info(`${n.repo.owner}/${n.repo.name}`) : brand.muted("System"),
      new Date(n.createdAt).toLocaleDateString(),
    ]);
  }

  return table.toString();
}
