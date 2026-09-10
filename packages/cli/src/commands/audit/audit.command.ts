import * as p from "@clack/prompts";
import type { Command } from "commander";

import { handleCliError } from "@/core/errors";

import { brand, pc } from "@/ui/colors";
import { stripHtml } from "@/ui/formatters";
import { withTaskSpinner } from "@/ui/spinner";

import { renderAuditTable } from "./audit.formatter";
import { auditService } from "./audit.service";
import type { AuditLogItem } from "./audit.types";

export function registerAuditCommand(program: Command) {
  const audit = program
    .command("audit")
    .alias("activity")
    .description("Inspect security, deployment, and configuration activity logs");

  audit
    .command("list", { isDefault: true })
    .description("List workspace audit logs with pagination support")
    .option("-l, --limit <number>", "Number of log entries to retrieve", "20")
    .option("-c, --cursor <cursorId>", "Pagination cursor ID")
    .option("--json", "Output log records in raw JSON format")
    .action(async (options: { cursor?: string; json?: boolean; limit: string }) => {
      try {
        const limit = options.limit ? Math.max(1, Math.min(100, Number(options.limit))) : 20;

        const data = await withTaskSpinner(
          {
            silent: options.json,
            start: "Retrieving workspace audit logs...",
            stop: "Audit logs retrieved",
          },
          () =>
            auditService.getActivityLogs({
              cursor: options.cursor,
              limit,
            }),
        );

        if (options.json) {
          console.log(JSON.stringify(data, null, 2));
          return;
        }

        if (data.items.length === 0) {
          p.outro(brand.muted("No recent audit activities recorded in your workspace."));
          return;
        }

        console.log(`\n${brand.logo(" 🛡️ Workspace Activity & Audit Records:\n")}`);
        console.log(renderAuditTable(data.items));
        console.log("\n");

        if (data.nextCursor) {
          console.log(
            `  ${pc.gray("Next page:")} ${brand.highlight(`dxnx audit list -c ${data.nextCursor}`)}\n`,
          );
        }

        p.outro(
          brand.muted("Inspect specific payload with: ") +
            brand.highlight("dxnx audit view <id-or-prefix>"),
        );
      } catch (error) {
        handleCliError(error);
      }
    });

  audit
    .command("view [logId]")
    .alias("payload")
    .description("Inspect detailed event payload (supports short ID prefix and interactive pick)")
    .option("--json", "Parse and output raw JSON payload")
    .option("--html", "Output raw Shiki syntax-highlighted HTML snippet")
    .action(async (logIdArg?: string, options?: { html?: boolean; json?: boolean }) => {
      try {
        let targetLogId = logIdArg?.trim();

        if (!targetLogId || targetLogId.length < 32) {
          const recent = await withTaskSpinner("Fetching recent logs for resolution...", () =>
            auditService.getActivityLogs({ limit: 25 }),
          );

          if (recent.items.length === 0) {
            p.outro(brand.muted("No audit logs available."));
            return;
          }

          if (targetLogId) {
            const prefix = targetLogId.toLowerCase();
            const match = recent.items.find((item: AuditLogItem) =>
              item.id.toLowerCase().startsWith(prefix),
            );
            if (!match) {
              p.outro(brand.error(`No log found matching prefix: '${targetLogId}'`));
              return;
            }
            targetLogId = match.id;
          } else {
            const selection = await p.select({
              message: "Select an audit event to inspect payload:",
              options: recent.items.map((item: AuditLogItem) => ({
                label: `${item.actionTitle} — ${item.targetName ?? item.entityType ?? "System"} (${new Date(item.createdAt).toLocaleTimeString()})`,
                value: item.id,
              })),
            });

            if (p.isCancel(selection) || typeof selection !== "string") {
              p.cancel("Cancelled.");
              return;
            }
            targetLogId = selection;
          }
        }

        const rawHtml = await withTaskSpinner(
          {
            silent: Boolean(options?.html || options?.json),
            start: `Fetching payload for ${brand.highlight(targetLogId.slice(0, 8))}...`,
            stop: "Payload loaded",
          },
          () => auditService.getLogPayloadHtml(targetLogId),
        );

        if (options?.html) {
          console.log(rawHtml);
          return;
        }

        const textPayload = stripHtml(rawHtml);

        if (options?.json) {
          try {
            const parsed: unknown = JSON.parse(textPayload);
            console.log(JSON.stringify(parsed, null, 2));
          } catch {
            console.log(textPayload);
          }
          return;
        }

        console.log(`\n${brand.info(`=== 📦 Audit Log Payload (${targetLogId}) ===`)}\n`);
        console.log(textPayload);
        console.log(`\n${brand.info("=== End of Payload ===")}\n`);

        p.outro(brand.success("✔ Payload inspection complete."));
      } catch (error) {
        handleCliError(error);
      }
    });
}
