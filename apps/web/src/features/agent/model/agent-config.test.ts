import { describe, expect, it } from "vitest";

import { TOOL_INVALIDATIONS, toolLabels } from "./agent-config";

describe("agent-config tool coverage", () => {
  it("every tool with cache invalidation has a human-readable label", () => {
    for (const toolName of Object.keys(TOOL_INVALIDATIONS)) {
      const label = toolLabels[toolName];
      expect(label, `missing label for tool: ${toolName}`).toBeDefined();
      expect(label!.trim(), `empty label for tool: ${toolName}`).not.toBe("");
    }
  });

  it("no invalidation references a tool name that does not exist", () => {
    const orphaned = Object.keys(TOOL_INVALIDATIONS).filter(
      (toolName) => !(toolName in toolLabels),
    );

    // agent.tsx calls TOOL_INVALIDATIONS[toolName]?.(); a typo here silently
    // skips cache invalidation, so any orphan key is a bug.
    expect(orphaned).toEqual([]);
  });
});
