import { describe, expect, it } from "vitest";

import { regexAdapter } from "./regex.adapter";

describe("regexAdapter", () => {
  it("exposes the fallback adapter metadata and parser hook", () => {
    expect(regexAdapter.id).toBe("regex-fallback");
    expect(regexAdapter.priority).toBeGreaterThan(0);
    expect(typeof regexAdapter.parse).toBe("function");
  });

  it("falls back to regex extraction for a tiny source sample", async () => {
    const parsed = await regexAdapter.parse({
      content: "export const answer = 42;\nexport function greet() { return 'hi'; }",
      path: "src/example.ts",
    });

    expect(parsed).toMatchObject({
      analysisMode: "heuristic",
      apiSurface: expect.any(Number),
      exports: expect.any(Number),
      imports: expect.any(Array),
    });
  });
});
