import * as p from "@clack/prompts";
import { TRPCClientError } from "@trpc/client";

import { brand } from "../ui/colors";
import { getApiUrl } from "./config";

export function handleCliError(error: unknown): never {
  if (error instanceof TRPCClientError) {
    if (error.data?.code === "UNAUTHORIZED") {
      p.outro(
        brand.error("🔒 You are not authenticated or your token has expired.\n") +
          brand.muted("Run ") +
          brand.highlight("dxnx login") +
          brand.muted(" to authenticate."),
      );
      process.exit(1);
    }

    if (error.message.includes("Unable to connect") || error.message.includes("fetch failed")) {
      p.outro(
        brand.error(
          `🔌 Could not connect to Doxynix server at ${brand.highlight(getApiUrl())}.\n\n`,
        ) +
          brand.muted("Ensure the backend service is running ") +
          brand.highlight("(e.g., bun run --filter=@doxynix/web dev)\n") +
          brand.muted("or override the endpoint using ") +
          brand.highlight("DOXYNIX_API_URL=https://your-domain.com/api"),
      );
      process.exit(1);
    }

    p.outro(brand.error(`❌ API Error: ${error.message}`));
    process.exit(1);
  }

  if (error instanceof Error) {
    if (error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED")) {
      p.outro(
        brand.error(`🔌 Doxynix server is unreachable at ${getApiUrl()}.\n`) +
          brand.muted("Start the web service or check your DOXYNIX_API_URL variable."),
      );
      process.exit(1);
    }

    p.outro(brand.error(`❌ Error: ${error.message}`));
    process.exit(1);
  }

  p.outro(brand.error("❌ An unexpected error occurred."));
  process.exit(1);
}
