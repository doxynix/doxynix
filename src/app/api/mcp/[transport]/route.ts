import type { ToolExecutionOptions } from "ai";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";

import { APP_VERSION } from "@/shared/constants/env.server";

import { appLogger } from "@/server/core/app-logger";
import { AGENT_SYSTEM_PROMPT } from "@/server/modules/agent/agent.prompts";
import { getAgentTools } from "@/server/modules/agent/agent.tools";
import { verifyAndUseApiKey } from "@/server/utils/verify-and-use-api-key";

type GenericExecuteFn = (
  args: Record<string, unknown>,
  context: ToolExecutionOptions
) => Promise<unknown>;

const handler = createMcpHandler(
  (server) => {
    const agentTools = getAgentTools();

    for (const [name, toolObj] of Object.entries(agentTools)) {
      const executeFn = toolObj.execute;

      if (typeof executeFn !== "function") {
        continue;
      }

      const inputSchema = toolObj.inputSchema;

      if (!(inputSchema instanceof z.ZodObject)) {
        continue;
      }

      server.registerTool(
        name,
        {
          description: toolObj.description ?? "",
          inputSchema: inputSchema,
          title: name,
        },
        async (args) => {
          try {
            const parsedArgs = inputSchema.parse(args);

            const dummyContext: ToolExecutionOptions = {
              messages: [],
              toolCallId: `mcp-${name}-${Date.now()}`,
            };

            const safeExecute = executeFn as unknown as GenericExecuteFn;
            const result = await safeExecute(parsedArgs as Record<string, unknown>, dummyContext);

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
              tool: name,
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
        }
      );
    }
  },
  {
    instructions: AGENT_SYSTEM_PROMPT,
    serverInfo: {
      name: "Doxynix",
      version: APP_VERSION,
    },
  },
  {
    basePath: "/api/mcp",
    maxDuration: 60,
    verboseLogs: true,
  }
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

    return {
      clientId: String(keyRecord.userId),
      scopes: [] as string[],
      token: bearer,
    };
  },
  {
    required: true,
  }
);

export { withMcpAuthHandler as GET, withMcpAuthHandler as POST };
