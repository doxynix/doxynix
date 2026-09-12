import * as p from "@clack/prompts";
import type { Command } from "commander";

import { confirmOrAbort, resolveEntityOrPick } from "@/core/prompts";

import { brand } from "@/ui/colors";
import { formatRelativeTime } from "@/ui/formatters";
import { renderSection } from "@/ui/layout";
import { output } from "@/ui/output";
import { withTaskSpinner } from "@/ui/spinner";

import {
  renderNotificationDetails,
  renderNotificationStatsTable,
  renderNotificationsTable,
} from "./notifications.formatter";
import { notificationsService } from "./notifications.service";
import type { NotificationItem } from "./notifications.types";

async function resolveNotificationId(
  idArg?: string,
  filter?: { isRead?: boolean },
): Promise<string | null> {
  return resolveEntityOrPick({
    emptyMessage: "No notifications matching criteria found.",
    fetchItems: async () => {
      const result = await notificationsService.list(50, filter?.isRead, 1);
      return result.items;
    },
    getLabel: (item: NotificationItem) =>
      `[${item.type}] ${item.title} (${formatRelativeTime(item.createdAt)}) [${item.id.slice(0, 8)}]`,
    idArg,
    notFoundMessage: (target) => `No notification found matching prefix: '${target}'`,
    selectMessage: "Select a notification:",
  });
}

export function registerNotificationsCommand(program: Command) {
  const notification = program
    .command("notifications")
    .alias("notif")
    .description("View and manage platform system notifications");

  notification
    .command("list", { isDefault: true })
    .description("List recent notifications with page pagination")
    .option("-a, --all", "Include all notifications (including read)", false)
    .option("-c, --cursor <page>", "Page number for pagination", "1")
    .option("-l, --limit <number>", "Number of notifications per page", "15")
    .option("--json", "Output in JSON format")
    .action(async (options: { all?: boolean; cursor?: string; json?: boolean; limit?: string }) => {
      const parsedLimit = Number(options.limit);
      const limit =
        Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(100, parsedLimit) : 15;
      const parsedCursor = Number(options.cursor);
      const cursor = Number.isFinite(parsedCursor) && parsedCursor > 0 ? parsedCursor : 1;

      const result = await withTaskSpinner(
        {
          silent: options.json,
          start: `Fetching notifications (page ${cursor})...`,
          stop: "Notifications loaded",
        },
        () => notificationsService.list(limit, options.all ? undefined : false, cursor),
      );

      if (output.json(result, options.json)) {
        return;
      }

      if (result.items.length === 0) {
        p.outro(brand.success("No notifications found on this page."));
        return;
      }

      console.log(
        renderSection(
          brand.logo("Workspace Notifications:"),
          renderNotificationsTable(result.items),
        ),
      );

      const hasNextPage = result.items.length === limit;
      let footer = brand.muted(`Page ${cursor} (showing ${result.items.length} items).`);

      if (hasNextPage) {
        footer +=
          brand.muted("\nNext page: ") +
          brand.highlight(
            `dxnx notifications list -c ${cursor + 1} -l ${limit}${options.all ? " -a" : ""}`,
          ) +
          brand.muted("\nMark current as read: ") +
          brand.highlight("dxnx notifications clear");
      } else {
        footer += brand.muted(" Mark all as read: ") + brand.highlight("dxnx notifications clear");
      }

      p.outro(footer);
    });

  notification
    .command("view [id]")
    .description("View notification details (checks recent page or displays by ID)")
    .action(async (idArg?: string) => {
      const targetId = await resolveNotificationId(idArg);
      if (!targetId) {
        return;
      }

      const recent = await notificationsService.list(50, undefined, 1);
      const item = recent.items.find(
        (n: NotificationItem) => n.id === targetId || n.id.startsWith(targetId),
      );

      if (!item) {
        p.outro(
          brand.warning(
            `Notification ${brand.highlight(targetId.slice(0, 8))} is not in recent 50 items.\n` +
              `To locate older notifications, use: ${brand.highlight("dxnx notifications list -c <page> -a")}`,
          ),
        );
        return;
      }

      renderNotificationDetails(item);
    });

  notification
    .command("clear")
    .description("Mark all unread notifications as read")
    .action(async () => {
      p.intro(brand.logo(" Clear Notifications "));
      const result = await withTaskSpinner(
        { start: "Updating notification statuses...", stop: "Done!" },
        () => notificationsService.markAllAsRead(),
      );
      p.outro(brand.success(result.message));
    });

  notification
    .command("stats")
    .description("Display summary counters of unread and read notifications")
    .option("--json", "Output in JSON format")
    .action(async (options: { json?: boolean }) => {
      const stats = await withTaskSpinner(
        {
          silent: options.json,
          start: "Calculating notification stats...",
          stop: "Stats loaded",
        },
        () => notificationsService.getStats(),
      );

      if (output.json(stats, options.json)) {
        return;
      }

      console.log(
        renderSection(
          brand.logo(" Notifications Summary:"),
          renderNotificationStatsTable(stats ?? { read: 0, total: 0, unread: 0 }),
        ),
      );
      p.outro(brand.muted("Manage with: dxnx notifications list | clear | prune"));
    });

  notification
    .command("read [id]")
    .description("Mark a notification as read (supports Short-ID and picker)")
    .action(async (idArg?: string) => {
      const targetId = await resolveNotificationId(idArg, { isRead: false });
      if (!targetId) {
        return;
      }

      const result = await withTaskSpinner(
        { start: `Marking notification ${targetId.slice(0, 8)} as read...`, stop: "Updated!" },
        () => notificationsService.markAs(targetId, true),
      );
      p.outro(brand.success(result.message));
    });

  notification
    .command("unread [id]")
    .description("Mark a notification as unread (supports Short-ID and picker)")
    .action(async (idArg?: string) => {
      const targetId = await resolveNotificationId(idArg, { isRead: true });
      if (!targetId) {
        return;
      }

      const result = await withTaskSpinner(
        { start: `Marking notification ${targetId.slice(0, 8)} as unread...`, stop: "Updated!" },
        () => notificationsService.markAs(targetId, false),
      );
      p.outro(brand.success(result.message));
    });

  notification
    .command("delete [id]")
    .description("Permanently delete a notification (supports Short-ID and picker)")
    .action(async (idArg?: string) => {
      const targetId = await resolveNotificationId(idArg);
      if (!targetId) {
        return;
      }

      const confirmed = await confirmOrAbort({
        cancelMessage: "Deletion cancelled.",
        message: `Are you sure you want to permanently delete notification ${brand.highlight(targetId.slice(0, 8))}?`,
      });

      if (!confirmed) {
        return;
      }

      const result = await withTaskSpinner(
        { start: `Deleting notification ${targetId.slice(0, 8)}...`, stop: "Deleted!" },
        () => notificationsService.deleteOne(targetId),
      );
      p.outro(brand.success(result.message));
    });

  notification
    .command("prune")
    .description("Purge and permanently delete all read notifications")
    .action(async () => {
      p.intro(brand.warning(" Purge Read Notifications "));

      const confirmed = await confirmOrAbort({
        cancelMessage: "Prune cancelled.",
        message: "Are you sure you want to permanently delete all read notifications?",
      });

      if (!confirmed) {
        return;
      }

      const result = await withTaskSpinner(
        { start: "Pruning read notifications...", stop: "Done!" },
        () => notificationsService.deleteRead(),
      );

      p.outro(brand.success(`${result.message} (${result.deletedCount} items removed)`));
    });
}
