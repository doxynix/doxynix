import * as p from "@clack/prompts";
import type { Command } from "commander";

import { resolveEntityOrPick } from "@/core/prompts";

import { brand } from "@/ui/colors";
import { formatRelativeTime, stripHtml } from "@/ui/formatters";
import { renderBlock, renderSection } from "@/ui/layout";
import { output } from "@/ui/output";
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
      const parsedLimit = Number(options.limit);
      const limit =
        Number.isFinite(parsedLimit) && parsedLimit > 0
          ? Math.max(1, Math.min(100, Math.floor(parsedLimit)))
          : 20;

      const result = await withTaskSpinner(
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

      if (output.json(result, options.json)) {
        return;
      }

      if (result.items.length === 0) {
        p.outro(brand.muted("No recent audit activities recorded in your workspace."));
        return;
      }

      console.log(
        renderSection(
          brand.logo("Workspace Activity & Audit Records:"),
          renderAuditTable(result.items),
        ),
      );

      if (result.nextCursor) {
        p.outro(
          brand.muted("Next page: ") +
            brand.highlight(`dxnx audit list -c ${result.nextCursor}\n`) +
            brand.muted("Inspect specific payload with: ") +
            brand.highlight("dxnx audit view <id-or-prefix>"),
        );
      } else {
        p.outro(
          brand.muted("Inspect specific payload with: ") +
            brand.highlight("dxnx audit view <id-or-prefix>"),
        );
      }
    });

  audit
    .command("view [logId]")
    .alias("payload")
    .description("Inspect detailed event payload (supports short ID prefix and interactive pick)")
    .option("--json", "Parse and output raw JSON payload")
    .option("--html", "Output raw Shiki syntax-highlighted HTML snippet")
    .action(async (logIdArg?: string, options?: { html?: boolean; json?: boolean }) => {
      const targetLogId = await resolveEntityOrPick({
        cancelMessage: "Cancelled.",
        emptyMessage: "No audit logs available.",
        fetchItems: async () => {
          const recent = await withTaskSpinner("Fetching recent logs for resolution...", () =>
            auditService.getActivityLogs({ limit: 25 }),
          );
          return recent.items;
        },
        getLabel: (item: AuditLogItem) =>
          `${item.actionTitle} — ${item.targetName ?? item.entityType ?? "System"} (${formatRelativeTime(item.createdAt)})`,
        idArg: logIdArg,
        notFoundMessage: (prefix) => `No log found matching prefix: '${prefix}'`,
        selectMessage: "Select an audit event to inspect payload:",
      });

      if (!targetLogId) {
        return;
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
          output.json(parsed, true);
        } catch {
          output.write(textPayload);
        }
        return;
      }

      console.log(renderBlock(`Audit Log Payload (${targetLogId})`, textPayload));
      p.outro(brand.success("Payload inspection complete."));
    });
}
