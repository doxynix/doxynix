import * as p from "@clack/prompts";
import type { Command } from "commander";

import { trpc } from "@/core/client";
import { getApiUrl, getToken } from "@/core/config";
import { handleCliError } from "@/core/errors";

import { brand } from "@/ui/colors";

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

        const s = p.spinner();
        s.start(`Connecting to ${apiUrl}...`);

        const start = performance.now();
        const health = await trpc.health.check.query({});
        const latency = Math.round(performance.now() - start);

        s.stop("Server responded successfully!");

        console.log(`\n  API URL:       ${brand.highlight(apiUrl)}`);
        console.log(
          `  Server Status: ${health.status === "ok" ? brand.success("● Online (OK)") : brand.warning(health.status)}`,
        );
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
