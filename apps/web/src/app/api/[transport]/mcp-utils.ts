import * as z from "zod";

import { appLogger } from "@/server/core/app-logger";
import { MUTATION_TOOLS } from "@/server/modules/agent/agent.tools";

export type RawTool = {
  execute: unknown;
  inputSchema: unknown;
  description?: string;
};

const isFunction = (value: unknown): value is (...args: unknown[]) => unknown =>
  typeof value === "function";

export function filterAndPrepareTools(agentTools: Record<string, RawTool>) {
  const validTools: Array<{
    name: string;
    description: string;
    inputSchema: z.ZodObject<any>;
    execute: (...args: unknown[]) => unknown;
  }> = [];

  for (const [name, toolObj] of Object.entries(agentTools)) {
    if (!isFunction(toolObj.execute)) {
      continue;
    }

    if ((MUTATION_TOOLS as readonly string[]).includes(name)) {
      appLogger.debug({ msg: "Skipping mutation tool in MCP registration", tool: name });
      continue;
    }

    if (!(toolObj.inputSchema instanceof z.ZodObject)) {
      continue;
    }

    validTools.push({
      description: toolObj.description ?? "",
      execute: toolObj.execute,
      inputSchema: toolObj.inputSchema,
      name,
    });
  }

  return validTools;
}
