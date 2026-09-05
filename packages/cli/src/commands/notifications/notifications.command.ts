import * as p from "@clack/prompts";
import type { Command } from "commander";

import { handleCliError } from "@/core/errors";

import { brand } from "@/ui/colors";

import { renderNotificationStatsTable, renderNotificationsTable } from "./notifications.formatter";
import { notificationsService } from "./notifications.service";

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
        const s = p.spinner();
        if (!options.json) {
          s.start("Fetching notifications...");
        }

        const data = await notificationsService.list(15, options.all ? undefined : false);

        if (!options.json) {
          s.stop("Notifications loaded");
        }

        if (options.json) {
          console.log(JSON.stringify(data, null, 2));
          return;
        }

        if (data.items.length === 0) {
          p.outro(brand.success("🎉 You have no unread notifications!"));
          return;
        }

        console.log(`\n${renderNotificationsTable(data.items)}\n`);
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

        const s = p.spinner();
        s.start("Updating notification status...");
        const res = await notificationsService.markAllAsRead();
        s.stop("Done!");

        p.outro(brand.success(`✅ ${res.message}`));
      } catch (error) {
        handleCliError(error);
      }
    });

  // dxnx notifications stats
  notification
    .command("stats")
    .description("Display summary counters of unread and read notifications")
    .option("--json", "Output in JSON format")
    .action(async (options: { json?: boolean }) => {
      try {
        const s = p.spinner();
        if (!options.json) {
          s.start("Calculating notification stats...");
        }
        const stats = await notificationsService.getStats();
        if (!options.json) {
          s.stop("Stats loaded");
        }

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

  // dxnx notifications read <id>
  notification
    .command("read <id>")
    .description("Mark a specific notification as read")
    .action(async (id: string) => {
      try {
        const s = p.spinner();
        s.start(`Updating notification ${id}...`);
        const res = await notificationsService.markAs(id, true);
        s.stop("Updated!");
        p.outro(brand.success(`✔ ${res.message}`));
      } catch (error) {
        handleCliError(error);
      }
    });

  // dxnx notifications unread <id>
  notification
    .command("unread <id>")
    .description("Mark a specific notification as unread")
    .action(async (id: string) => {
      try {
        const s = p.spinner();
        s.start(`Updating notification ${id}...`);
        const res = await notificationsService.markAs(id, false);
        s.stop("Updated!");
        p.outro(brand.success(`✔ ${res.message}`));
      } catch (error) {
        handleCliError(error);
      }
    });

  // dxnx notifications delete <id>
  notification
    .command("delete <id>")
    .description("Permanently delete a single notification")
    .action(async (id: string) => {
      try {
        const s = p.spinner();
        s.start(`Deleting notification ${id}...`);
        const res = await notificationsService.deleteOne(id);
        s.stop("Deleted!");
        p.outro(brand.success(`✔ ${res.message}`));
      } catch (error) {
        handleCliError(error);
      }
    });

  // dxnx notifications prune
  notification
    .command("prune")
    .description("Purge and permanently delete all notifications marked as read")
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

        const s = p.spinner();
        s.start("Pruning read notifications...");
        const res = await notificationsService.deleteRead();
        s.stop("Done!");

        p.outro(brand.success(`✔ ${res.message} (${res.deletedCount} items removed)`));
      } catch (error) {
        handleCliError(error);
      }
    });
}
