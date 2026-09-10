import * as p from "@clack/prompts";
import type { Command } from "commander";

import { getApiUrl, getToken } from "@/core/config";
import { handleCliError } from "@/core/errors";

import { brand } from "@/ui/colors";
import { withTaskSpinner } from "@/ui/spinner";

import { formatHealthStatus } from "./system.formatter";
import { systemService } from "./system.service";

export function registerSystemCommands(program: Command) {
  program
    .command("status")
    .alias("ping")
    .description("Check API health and latency to Doxynix platform")
    .action(async () => {
      try {
        p.intro(brand.logo(" 🛰️ System Health Check "));

        const apiUrl = getApiUrl();
        const token = getToken();

        let latency = 0;
        const health = await withTaskSpinner(
          {
            start: `Connecting to ${apiUrl}...`,
            stop: "Server responded successfully!",
          },
          async () => {
            const start = performance.now();
            const res = await systemService.checkHealth();
            latency = Math.round(performance.now() - start);
            return res;
          },
        );

        console.log(`\n  API URL:       ${brand.highlight(apiUrl)}`);
        console.log(`  Server Status: ${formatHealthStatus(health.status)}`);
        console.log(`  Latency:       ${brand.info(`${latency} ms`)}`);
        console.log(
          `  Auth Status:   ${token ? brand.success("✔ Token found") : brand.warning("✖ Not authenticated")}\n`,
        );

        p.outro(brand.success("✨ Connection to platform is healthy!"));
      } catch (error) {
        handleCliError(error);
      }
    });
}
