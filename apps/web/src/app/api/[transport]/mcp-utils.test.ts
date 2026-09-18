import { describe, expect, it, vi } from "vitest";
import * as z from "zod";

import { filterAndPrepareTools } from "./mcp-utils";

vi.mock("@/server/core/app-logger", () => ({ appLogger: { debug: vi.fn() } }));

describe("filterAndPrepareTools", () => {
  it("should clean tools from unsafe schemas and approval blocks", () => {
    const mockRawTools = {
      badSchema: { execute: () => {}, inputSchema: z.string() },
      safeTool: { execute: () => {}, inputSchema: z.object({ id: z.string() }) },
      unsafeTool: { execute: () => {}, inputSchema: z.object({}), needsApproval: true },
    };

    const result = filterAndPrepareTools(mockRawTools);

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("safeTool");
  });
});
