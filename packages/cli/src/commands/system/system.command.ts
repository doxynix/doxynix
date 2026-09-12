import * as p from "@clack/prompts";
import type { Command } from "commander";

import { getApiUrl, getToken } from "@/core/config";

import { brand } from "@/ui/colors";
import { renderCard } from "@/ui/layout";
import { withTaskSpinner } from "@/ui/spinner";

import { formatHealthStatus } from "./system.formatter";
import { systemService } from "./system.service";

export function registerSystemCommands(program: Command) {
  program
    .command("status")
    .alias("ping")
    .description("Check API health and latency to Doxynix platform")
    .action(async () => {
      p.intro(brand.logo("System Health Check"));

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
          const result = await systemService.checkHealth();
          latency = Math.round(performance.now() - start);
          return result;
        },
      );

      console.log(
        renderCard("Platform Health Overview", [
          ["API URL", brand.highlight(apiUrl)],
          ["Server Status", formatHealthStatus(health.status)],
          ["Latency", brand.info(`${latency} ms`)],
          [
            "Auth Status",
            token ? brand.success("Token found") : brand.warning("Not authenticated"),
          ],
        ]),
      );

      if (health.status !== "ok") {
        p.outro(brand.warning(`Platform status is not healthy: ${health.status}`));
        return;
      }

      p.outro(brand.success("Connection to platform is healthy!"));
    });
}
