import * as p from "@clack/prompts";
import type { Command } from "commander";

import { handleCliError } from "@/core/errors";

import { brand } from "@/ui/colors";

import { renderAuditTable } from "./audit.formatter";
import { auditService } from "./audit.service";

export function registerAuditCommand(program: Command) {
  program
    .command("audit")
    .alias("activity")
    .description("Inspect security, deployment, and configuration activity logs")
    .option("-l, --limit <number>", "Number of log entries to retrieve", "20")
    .option("--json", "Output log records in raw JSON format")
    .action(async (options: { json?: boolean; limit: string }) => {
      const s = p.spinner();
      let spinnerActive = false;
      try {
        let limit = 20;
        if (options.limit !== undefined) {
          const parsed = Number(options.limit);
          if (!Number.isSafeInteger(parsed) || parsed <= 0) {
            p.outro(brand.error("--limit must be a positive integer"));
            return;
          }
          limit = parsed;
        }

        if (!options.json) {
          s.start("Retrieving workspace audit logs...");
          spinnerActive = true;
        }

        const data = await auditService.getActivityLogs(limit);
        if (!options.json && spinnerActive) {
          s.stop("Audit logs retrieved");
          spinnerActive = false;
        }

        if (options.json) {
          console.log(JSON.stringify(data, null, 2));
          return;
        }

        if (!data.items || data.items.length === 0) {
          p.outro(brand.muted("No recent audit activities recorded in your workspace."));
          return;
        }

        console.log(`\n${brand.logo(" 🛡️ Workspace Activity & Audit Records:\n")}`);
        console.log(renderAuditTable(data.items));
        console.log("\n");
        p.outro(brand.muted(`Retrieved ${data.items.length} records.`));
      } catch (error) {
        if (spinnerActive) {
          s.stop();
        }
        handleCliError(error);
      }
    });
}
