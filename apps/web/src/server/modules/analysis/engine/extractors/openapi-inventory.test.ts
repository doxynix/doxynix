import { describe, expect, it } from "vitest";

import { OpenApiDiscoveryEngine } from "./openapi-inventory";

describe("OpenApiDiscoveryEngine.collect", () => {
  it("extracts paths and counts HTTP operations from valid OpenAPI YAML", () => {
    const yamlContent = `
openapi: 3.0.0
paths:
  /api/v1/users:
    get: {}
    post: {}
  /api/v1/users/{id}:
    delete: {}
`;
    const inventory = OpenApiDiscoveryEngine.collect([
      { content: yamlContent, path: "docs/openapi.yaml" },
    ]);

    expect(inventory.sourceFiles).toEqual(["docs/openapi.yaml"]);
    expect(inventory.pathPatterns).toEqual(["/api/v1/users", "/api/v1/users/{id}"]);
    expect(inventory.estimatedOperations).toBe(3);
  });

  it("skips non-spec files and files > 5MB", () => {
    const inventory = OpenApiDiscoveryEngine.collect([
      { content: "export const x = 1;", path: "src/api.ts" },
      { content: "a".repeat(6 * 1024 * 1024), path: "huge.yaml" },
    ]);

    expect(inventory.sourceFiles).toEqual([]);
    expect(inventory.estimatedOperations).toBe(0);
  });
});
