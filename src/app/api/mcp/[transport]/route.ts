import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";

import { APP_VERSION } from "@/shared/constants/env.server";

import { AGENT_SYSTEM_PROMPT } from "@/server/modules/agent/agent.prompts";
import { getAgentTools } from "@/server/modules/agent/agent.tools";
import { verifyAndUseApiKey } from "@/server/utils/verify-and-use-api-key";

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
            const result = await executeFn(args as any, {} as any);
            return {
              content: [
                {
                  text: typeof result === "string" ? result : JSON.stringify(result),
                  type: "text",
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  text: error instanceof Error ? error.message : String(error),
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
  { required: true }
);

export { withMcpAuthHandler as GET, withMcpAuthHandler as POST };
