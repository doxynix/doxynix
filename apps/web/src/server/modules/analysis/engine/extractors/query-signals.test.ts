import { describe, expect, it } from "vitest";

import { typescriptQuerySpec } from "./queries/typescript";
import { collectQuerySignals } from "./query-signals";

const FIXTURE = [
  'import { Hono } from "hono";',
  "export function greet(name: string) { return name; }",
  "function internal() {}",
  "class UserService { run() {} }",
  'const app = new Hono(); app.get("/users", handler);',
].join("\n");

describe("collectQuerySignals", () => {
  it("normalizes symbols, imports, exports and routes", async () => {
    const result = await collectQuerySignals(
      { content: FIXTURE, path: "src/api.ts" },
      ".ts",
      typescriptQuerySpec,
    );

    expect(result).not.toBeNull();
    expect(result?.symbols?.map((symbol) => symbol.name)).toEqual([
      "greet",
      "internal",
      "UserService",
      "run",
    ]);
    expect(result?.symbols?.find((symbol) => symbol.name === "greet")?.exported).toBe(true);
    expect(result?.symbols?.find((symbol) => symbol.name === "internal")?.exported).toBe(false);
    expect(result?.imports).toEqual(["hono"]);
    expect(result?.exports).toBe(1);
    expect(result?.routes).toEqual([
      expect.objectContaining({ framework: "Hono", method: "GET", path: "/users" }),
    ]);
    expect(result?.parseError).toBe(false);
  });
});
