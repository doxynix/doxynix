import * as p from "@clack/prompts";
import { TRPCClientError } from "@trpc/client";

import { brand } from "@/ui/colors";
import { icons } from "@/ui/icons";

import { getApiUrl } from "./config";
import { PromptCancelledError } from "./prompts";

export function handleCliError(error: unknown): never {
  if (process.stderr.isTTY) {
    process.stderr.write("\x1B[?25h");
  }

  const isJsonMode = process.argv.includes("--json");

  if (error instanceof PromptCancelledError) {
    process.exit(0);
  }

  if (isJsonMode) {
    const message = error instanceof Error ? error.message : String(error);
    const code =
      error instanceof TRPCClientError
        ? typeof error.data?.code === "string"
          ? error.data.code
          : "API_ERROR"
        : "ERROR";

    process.stdout.write(`${JSON.stringify({ code, error: message, success: false }, null, 2)}\n`);
    process.exit(1);
  }

  if (error instanceof TRPCClientError) {
    if (error.data?.code === "UNAUTHORIZED") {
      const serverMessage =
        error.message && error.message !== "UNAUTHORIZED" ? `: ${error.message}` : "";
      p.outro(
        brand.error(`${icons.lock} Authorization failed${serverMessage}\n`) +
          brand.muted("Run ") +
          brand.highlight("dxnx login") +
          brand.muted(" to re-authenticate or verify your linked accounts / permissions."),
      );
      process.exit(1);
    }

    if (error.message.includes("Unable to connect") || error.message.includes("fetch failed")) {
      p.outro(
        brand.error(
          `${icons.warning} Could not connect to Doxynix server at ${brand.highlight(getApiUrl())}.\n\n`,
        ) +
          brand.muted("Ensure the backend service is running ") +
          brand.highlight("(e.g., bun run --filter=@doxynix/web dev)\n") +
          brand.muted("or override the endpoint using ") +
          brand.highlight("DOXYNIX_API_URL=https://your-domain.com/api"),
      );
      process.exit(1);
    }

    p.outro(brand.error(`${icons.cross} API Error: ${error.message}`));
    process.exit(1);
  }

  if (error instanceof Error) {
    if (error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED")) {
      p.outro(
        brand.error(`${icons.warning} Doxynix server is unreachable at ${getApiUrl()}.\n`) +
          brand.muted("Start the web service or check your DOXYNIX_API_URL variable."),
      );
      process.exit(1);
    }

    p.outro(brand.error(`${icons.cross} Error: ${error.message}`));
    process.exit(1);
  }

  p.outro(brand.error(`${icons.cross} An unexpected error occurred.`));
  process.exit(1);
}
