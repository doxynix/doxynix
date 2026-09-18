import * as z from "zod";

import { appLogger } from "@/server/core/app-logger";

export interface RawTool {
  execute: unknown;
  needsApproval?: boolean;
  inputSchema: unknown;
  description?: string;
}

export function filterAndPrepareTools(agentTools: Record<string, RawTool>) {
  const validTools: Array<{
    name: string;
    description: string;
    inputSchema: z.ZodObject<any>;
    execute: Function;
  }> = [];

  for (const [name, toolObj] of Object.entries(agentTools)) {
    if (typeof toolObj.execute !== "function") {
      continue;
    }

    if (toolObj.needsApproval === true) {
      appLogger.debug({ msg: "Skipping approval-required tool in MCP registration", tool: name });
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
