import { brand, pc } from "@/ui/colors";
import { formatDateTime, formatRelativeTime } from "@/ui/formatters";
import { type NoticeLevel, renderNoticeBox } from "@/ui/notify";
import { createTable } from "@/ui/table";

import type { NotificationItem } from "./notifications.types";

export function formatNotificationType(type: string): string {
  switch (type) {
    case "ERROR": {
      return pc.bgRed(pc.bold(" ERROR "));
    }
    case "WARNING": {
      return pc.bgYellow(pc.bold(pc.black(" WARN ")));
    }
    case "SUCCESS": {
      return pc.bgGreen(pc.bold(pc.black(" OK ")));
    }
    default: {
      return pc.bgCyan(pc.bold(pc.black(" INFO ")));
    }
  }
}

export function renderNotificationsTable(items: NotificationItem[]): string {
  const table = createTable(["ID", "Type", "Title", "Repository", "Status", "Created"]);

  for (const n of items) {
    table.push([
      brand.muted(`${n.id.slice(0, 8)}...`),
      formatNotificationType(n.type),
      brand.highlight(n.title),
      n.repo ? pc.cyan(`${n.repo.owner}/${n.repo.name}`) : brand.muted("System"),
      n.isRead ? brand.muted("Read") : pc.yellow("● Unread"),
      brand.muted(formatRelativeTime(n.createdAt)),
    ]);
  }

  return table.toString();
}

const NOTIFICATION_TYPE_TO_LEVEL: Record<string, NoticeLevel> = {
  ERROR: "error",
  SUCCESS: "success",
  WARNING: "warning",
};

export function renderNotificationDetails(item: NotificationItem): void {
  const level = NOTIFICATION_TYPE_TO_LEVEL[item.type];

  const lines = [
    `${pc.bold("ID:")}          ${brand.muted(item.id)}`,
    `${pc.bold("Context:")}     ${item.repo ? pc.cyan(`${item.repo.owner}/${item.repo.name}`) : brand.muted("Global / System")}`,
    `${pc.bold("Received:")}    ${brand.muted(formatDateTime(item.createdAt))}`,
    `${pc.bold("Status:")}      ${item.isRead ? brand.muted("Marked as read") : pc.yellow("Unread")}`,
  ];

  if (item.body) {
    lines.push("", `${pc.bold("Message:")}\n  ${item.body}`);
  }

  console.log(renderNoticeBox(item.title, lines, level));
}

export function renderNotificationStatsTable(stats: {
  total: number;
  unread: number;
  read: number;
}): string {
  const table = createTable(["Status", "Count"]);
  table.push(
    [pc.yellow("● Unread"), brand.highlight(String(stats.unread))],
    [brand.success(" Read"), brand.muted(String(stats.read))],
    [brand.info("Σ Total"), brand.highlight(String(stats.total))],
  );
  return table.toString();
}
