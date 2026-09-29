import type { FlexibleSchema, Tool } from "ai";
import * as z from "zod";

import { appLogger } from "@/server/core/app-logger";
import { MUTATION_TOOLS } from "@/server/modules/agent/agent.tools";

export type RawTool = {
  execute: unknown;
  /**
   * The AI SDK types a tool's schema as `FlexibleSchema`, which also admits plain
   * `StandardSchemaV1` validators, and its `description` as either a literal or a
   * factory over the chat context. This module only ever calls `.parse` and filters
   * to real Zod objects, so both stay as wide as the SDK's and are narrowed below.
   */
  description?: Tool["description"];
  inputSchema: FlexibleSchema<unknown>;
};

const isFunction = (value: unknown): value is (...args: unknown[]) => unknown =>
  typeof value === "function";

/**
 * The MCP registry wants a literal string and has no chat context to hand a
 * description factory. Every tool in `getAgentTools()` passes a literal, so the
 * factory branch is a guard, not a live path.
 */
const resolveDescription = (description: Tool["description"]): string =>
  typeof description === "string" ? description : "";

export function filterAndPrepareTools(agentTools: Record<string, RawTool>) {
  const validTools: Array<{
    name: string;
    description: string;
    inputSchema: z.ZodObject;
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
      description: resolveDescription(toolObj.description),
      execute: toolObj.execute,
      inputSchema: toolObj.inputSchema,
      name,
    });
  }

  return validTools;
}
