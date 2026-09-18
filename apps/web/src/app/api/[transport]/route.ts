import type { ToolExecutionOptions } from "ai";
import { createMcpHandler, withMcpAuth } from "mcp-handler";

import { APP_VERSION } from "@/shared/config/env.server";

import { appLogger } from "@/server/core/app-logger";
import { AGENT_SYSTEM_PROMPT } from "@/server/modules/agent/agent.prompts";
import { getAgentTools } from "@/server/modules/agent/agent.tools";
import { verifyAndUseApiKey } from "@/server/utils/verify-and-use-api-key";

import { filterAndPrepareTools } from "./mcp-utils";

type GenericExecuteFn = (
  args: Record<string, unknown>,
  context: ToolExecutionOptions,
) => Promise<unknown>;

const handler = createMcpHandler(
  (server) => {
    const preparedTools = filterAndPrepareTools(getAgentTools() as any);

    for (const tool of preparedTools) {
      server.registerTool(
        tool.name,
        { description: tool.description, inputSchema: tool.inputSchema, title: tool.name },
        async (args) => {
          try {
            const parsedArgs = tool.inputSchema.parse(args);
            const dummyContext: ToolExecutionOptions = {
              messages: [],
              toolCallId: `mcp-${tool.name}-${Date.now()}`,
            };
            const result = await (tool.execute as unknown as GenericExecuteFn)(
              parsedArgs,
              dummyContext,
            );

            return {
              content: [
                {
                  text: typeof result === "string" ? result : JSON.stringify(result),
                  type: "text",
                },
              ],
            };
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            appLogger.error({
              error: { message: err.message, stack: err.stack },
              msg: "MCP Tool execution failed",
              tool: tool.name,
            });
            return {
              content: [
                {
                  text: "An internal server error occurred while executing this tool.",
                  type: "text",
                },
              ],
              isError: true,
            };
          }
        },
      );
    }
  },
  { instructions: AGENT_SYSTEM_PROMPT, serverInfo: { name: "Doxynix", version: APP_VERSION } },
  { basePath: "/api", maxDuration: 60, verboseLogs: true },
);

const withMcpAuthHandler = withMcpAuth(
  handler,
  async (_request, bearer) => {
    if (bearer == null) {
      throw new Error("Unauthorized: Missing API Key.");
    }
    const keyRecord = await verifyAndUseApiKey(bearer);
    if (keyRecord == null) {
      throw new Error("Unauthorized: Invalid or revoked Doxynix API Key.");
    }
    return { clientId: String(keyRecord.userId), scopes: [], token: bearer };
  },
  { required: true },
);

export { withMcpAuthHandler as GET, withMcpAuthHandler as POST };
