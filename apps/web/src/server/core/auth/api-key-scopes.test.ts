import { ApiKeyScope } from "@doxynix/shared";
import { describe, expect, it } from "vitest";

import { hasApiKeyScope } from "./api-key-scopes";

const CLI = [ApiKeyScope.CLI];
const MCP = [ApiKeyScope.MCP];
const FULL = [ApiKeyScope.FULL];

describe("hasApiKeyScope", () => {
  it("grants everything to a full-scoped key", () => {
    expect(hasApiKeyScope(FULL, ApiKeyScope.CLI)).toBe(true);
    expect(hasApiKeyScope(FULL, ApiKeyScope.MCP)).toBe(true);
  });

  it("lets a CLI key reach the CLI surface only", () => {
    expect(hasApiKeyScope(CLI, ApiKeyScope.CLI)).toBe(true);
    expect(hasApiKeyScope(CLI, ApiKeyScope.MCP)).toBe(false);
  });

  it("lets an MCP key reach the MCP surface only", () => {
    expect(hasApiKeyScope(MCP, ApiKeyScope.MCP)).toBe(true);
    expect(hasApiKeyScope(MCP, ApiKeyScope.CLI)).toBe(false);
  });

  it("keeps CLI+MCP equivalent to FULL on both surfaces", () => {
    const combined = [ApiKeyScope.CLI, ApiKeyScope.MCP];

    expect(hasApiKeyScope(combined, ApiKeyScope.CLI)).toBe(true);
    expect(hasApiKeyScope(combined, ApiKeyScope.MCP)).toBe(true);
    expect(hasApiKeyScope(combined, ApiKeyScope.FULL)).toBe(false);
  });

  it("treats an empty array as full access so pre-scopes keys keep working", () => {
    expect(hasApiKeyScope([], ApiKeyScope.CLI)).toBe(true);
    expect(hasApiKeyScope([], ApiKeyScope.MCP)).toBe(true);
  });

  it("treats an absent array as a cookie session and grants access", () => {
    expect(hasApiKeyScope(undefined, ApiKeyScope.CLI)).toBe(true);
  });
});
