import * as p from "@clack/prompts";
import { TRPCClientError } from "@trpc/client";

import { brand } from "@/ui/colors";
import { icons } from "@/ui/icons";

import { getApiUrl } from "./config";
import { OptionValidationError } from "./options";
import { NonInteractiveError, PromptCancelledError } from "./prompts";

export function handleCliError(error: unknown): never {
  if (process.stderr.isTTY) {
    process.stderr.write("\x1B[?25h");
  }

  const isJsonMode = process.argv.includes("--json");

  if (error instanceof PromptCancelledError) {
    process.exit(0);
  }

  if (error instanceof NonInteractiveError) {
    if (isJsonMode) {
      process.stdout.write(
        `${JSON.stringify({ code: "NON_INTERACTIVE", error: error.hint, success: false }, null, 2)}\n`,
      );
      process.exit(1);
    }
    p.outro(
      brand.error(`${icons.warning} Interactive input required.\n`) + brand.muted(error.hint),
    );
    process.exit(1);
  }

  if (error instanceof OptionValidationError) {
    if (isJsonMode) {
      process.stdout.write(
        `${JSON.stringify({ code: "BAD_REQUEST", error: error.message, success: false }, null, 2)}\n`,
      );
      process.exit(1);
    }
    p.outro(brand.error(`${icons.cross} ${error.message}`));
    process.exit(1);
  }

  if (isJsonMode) {
    const message = error instanceof Error ? error.message : String(error);
    let code = "ERROR";
    if (error instanceof TRPCClientError) {
      code = typeof error.data?.code === "string" ? error.data.code : "API_ERROR";
    }

    process.stdout.write(`${JSON.stringify({ code, error: message, success: false }, null, 2)}\n`);
    process.exit(1);
  }

  if (error instanceof TRPCClientError) {
    if (error.data?.code === "UNAUTHORIZED") {
      const serverMessage =
        error.message && error.message !== "UNAUTHORIZED" ? `: ${error.message}` : "";

      if (error.data.kind === "octokit") {
        p.outro(
          brand.error(`${icons.lock} GitHub integration failed${serverMessage}\n`) +
            brand.muted("Reconnect the GitHub App with ") +
            brand.highlight("dxnx github install") +
            brand.muted(", then list your repositories with ") +
            brand.highlight("dxnx github repos") +
            brand.muted("."),
        );
        process.exit(1);
      }

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
