import * as p from "@clack/prompts";
import type { Command } from "commander";

import { handleCliError } from "@/core/errors";

import { brand } from "@/ui/colors";

import { renderNotificationsTable } from "./notifications.formatter";
import { notificationsService } from "./notifications.service";

export function registerNotificationsCommand(program: Command) {
  const notification = program
    .command("notifications")
    .alias("notifications")
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
}
