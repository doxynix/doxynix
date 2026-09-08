import * as p from "@clack/prompts";
import { type Command } from "commander";

import { handleCliError } from "@/core/errors";

import { brand } from "@/ui/colors";
import { withTaskSpinner } from "@/ui/spinner";

import {
  renderNotificationDetails,
  renderNotificationStatsTable,
  renderNotificationsTable,
} from "./notifications.formatter";
import { notificationsService } from "./notifications.service";
import { type NotificationItem } from "./notifications.types";

async function resolveNotificationId(
  idArg?: string,
  filter?: { isRead?: boolean },
): Promise<string | null> {
  const target = idArg?.trim();
  if (target && target.length >= 32) {
    return target;
  }

  const data = await notificationsService.list(50, filter?.isRead);
  if (data.items.length === 0) {
    p.outro(brand.muted("No notifications matching criteria found."));
    return null;
  }

  if (target) {
    const prefix = target.toLowerCase();
    const matched = data.items.find((item: NotificationItem) =>
      item.id.toLowerCase().startsWith(prefix),
    );
    if (!matched) {
      p.outro(brand.error(`No notification found matching prefix: '${target}'`));
      return null;
    }
    return matched.id;
  }

  const selection = await p.select({
    message: "Select a notification:",
    options: data.items.map((item: NotificationItem) => ({
      label: `[${item.type}] ${item.title} (${new Date(item.createdAt).toLocaleDateString()}) [${item.id.slice(0, 8)}]`,
      value: item.id,
    })),
  });

  if (p.isCancel(selection) || typeof selection !== "string") {
    p.cancel("Operation cancelled.");
    return null;
  }

  return selection;
}

export function registerNotificationsCommand(program: Command) {
  const notification = program
    .command("notifications")
    .alias("notif")
    .description("View and manage platform system notifications");

  notification
    .command("list", { isDefault: true })
    .description("List recent unread notifications")
    .option("-a, --all", "Include all notifications (including read)", false)
    .option("--json", "Output in JSON format")
    .action(async (options: { all?: boolean; json?: boolean }) => {
      try {
        const data = await withTaskSpinner(
          {
            silent: options.json,
            start: "Fetching notifications...",
            stop: "Notifications loaded",
          },
          () => notificationsService.list(15, options.all ? undefined : false),
        );

        if (options.json) {
          console.log(JSON.stringify(data, null, 2));
          return;
        }

        if (data.items.length === 0) {
          p.outro(brand.success("🎉 You have no unread notifications!"));
          return;
        }

        console.log(`\n${brand.logo(" 🔔 Workspace Notifications:\n")}`);
        console.log(renderNotificationsTable(data.items));
        console.log("\n");
        p.outro(
          brand.muted(`Showing ${data.items.length} notifications. Mark all as read: `) +
            brand.highlight("dxnx notifications clear"),
        );
      } catch (error) {
        handleCliError(error);
      }
    });

  notification
    .command("clear")
    .description("Mark all unread notifications as read")
    .action(async () => {
      try {
        p.intro(brand.logo(" 🔔 Clear Notifications "));
        const res = await withTaskSpinner(
          { start: "Updating notification statuses...", stop: "Done!" },
          () => notificationsService.markAllAsRead(),
        );
        p.outro(brand.success(`✅ ${res.message}`));
      } catch (error) {
        handleCliError(error);
      }
    });

  notification
    .command("stats")
    .description("Display summary counters of unread and read notifications")
    .option("--json", "Output in JSON format")
    .action(async (options: { json?: boolean }) => {
      try {
        const stats = await withTaskSpinner(
          {
            silent: options.json,
            start: "Calculating notification stats...",
            stop: "Stats loaded",
          },
          () => notificationsService.getStats(),
        );

        if (options.json) {
          console.log(JSON.stringify(stats, null, 2));
          return;
        }

        console.log(`\n${brand.logo(" 🔔 Notifications Summary:\n")}`);
        console.log(renderNotificationStatsTable(stats ?? { read: 0, total: 0, unread: 0 }));
        console.log("\n");
        p.outro(brand.muted("Manage with: dxnx notifications list | clear | prune"));
      } catch (error) {
        handleCliError(error);
      }
    });

  notification
    .command("read [id]")
    .description("Mark a notification as read (supports Short-ID and picker)")
    .action(async (idArg?: string) => {
      try {
        const targetId = await resolveNotificationId(idArg, { isRead: false });
        if (!targetId) {
          return;
        }

        const res = await withTaskSpinner(
          { start: `Marking notification ${targetId.slice(0, 8)} as read...`, stop: "Updated!" },
          () => notificationsService.markAs(targetId, true),
        );
        p.outro(brand.success(`✔ ${res.message}`));
      } catch (error) {
        handleCliError(error);
      }
    });

  notification
    .command("unread [id]")
    .description("Mark a notification as unread (supports Short-ID and picker)")
    .action(async (idArg?: string) => {
      try {
        const targetId = await resolveNotificationId(idArg, { isRead: true });
        if (!targetId) {
          return;
        }

        const res = await withTaskSpinner(
          { start: `Marking notification ${targetId.slice(0, 8)} as unread...`, stop: "Updated!" },
          () => notificationsService.markAs(targetId, false),
        );
        p.outro(brand.success(`✔ ${res.message}`));
      } catch (error) {
        handleCliError(error);
      }
    });

  notification
    .command("delete [id]")
    .description("Permanently delete a notification (supports Short-ID and picker)")
    .action(async (idArg?: string) => {
      try {
        const targetId = await resolveNotificationId(idArg);
        if (!targetId) {
          return;
        }

        const res = await withTaskSpinner(
          { start: `Deleting notification ${targetId.slice(0, 8)}...`, stop: "Deleted!" },
          () => notificationsService.deleteOne(targetId),
        );
        p.outro(brand.success(`✔ ${res.message}`));
      } catch (error) {
        handleCliError(error);
      }
    });

  notification
    .command("view [id]")
    .description("View full notification details (supports Short-ID and picker)")
    .action(async (idArg?: string) => {
      try {
        const targetId = await resolveNotificationId(idArg);
        if (!targetId) {
          return;
        }

        const data = await notificationsService.list(50);
        const item = data.items.find((n: NotificationItem) => n.id === targetId);
        if (!item) {
          p.outro(brand.error("Notification not found."));
          return;
        }

        renderNotificationDetails(item);
      } catch (error) {
        handleCliError(error);
      }
    });

  notification
    .command("prune")
    .description("Purge and permanently delete all read notifications")
    .action(async () => {
      try {
        p.intro(brand.warning(" 🧹 Purge Read Notifications "));

        const confirmed = await p.confirm({
          message: "Are you sure you want to permanently delete all read notifications?",
        });

        if (!confirmed || p.isCancel(confirmed)) {
          p.outro(brand.muted("Prune cancelled."));
          return;
        }

        const res = await withTaskSpinner(
          { start: "Pruning read notifications...", stop: "Done!" },
          () => notificationsService.deleteRead(),
        );

        p.outro(brand.success(`✔ ${res.message} (${res.deletedCount} items removed)`));
      } catch (error) {
        handleCliError(error);
      }
    });
}
