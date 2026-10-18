import { describe, expect, it, vi } from "vitest";
import * as z from "zod";

import { MUTATION_TOOLS } from "@/server/modules/agent/agent.tools";

import { filterAndPrepareTools } from "./mcp-utils";

vi.mock("@/server/core/app-logger", () => ({ appLogger: { debug: vi.fn() } }));

describe("filterAndPrepareTools", () => {
  it("should drop tools whose input schema is not a ZodObject", () => {
    const mockRawTools = {
      badSchema: { execute: () => {}, inputSchema: z.string() },
      safeTool: { execute: () => {}, inputSchema: z.object({ id: z.string() }) },
    };

    const result = filterAndPrepareTools(mockRawTools);

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("safeTool");
  });

  it("should drop mutation tools, which need user approval in the agent", () => {
    for (const name of MUTATION_TOOLS) {
      const result = filterAndPrepareTools({
        [name]: { execute: () => {}, inputSchema: z.object({}) },
      });

      expect(result).toEqual([]);
    }
  });

  it("should keep a tool whose name merely looks like a mutation tool", () => {
    const result = filterAndPrepareTools({
      applyFixPreview: { execute: () => {}, inputSchema: z.object({}) },
    });

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("applyFixPreview");
  });

  // An MCP-scoped key that could mint a FULL key would reach the CLI surface through it.
  it("should withhold every key-management tool from MCP", () => {
    const keyTools = ["createApiKey", "listApiKeys", "revokeApiKey", "updateApiKey"];
    const exposed = filterAndPrepareTools(
      Object.fromEntries(
        keyTools.map((name) => [name, { execute: () => {}, inputSchema: z.object({}) }]),
      ),
    );

    for (const name of ["createApiKey", "updateApiKey"]) {
      expect(MUTATION_TOOLS).toContain(name);
    }
    expect(exposed.map((tool) => tool.name)).not.toContain("createApiKey");
    expect(exposed.map((tool) => tool.name)).not.toContain("updateApiKey");
  });
});
