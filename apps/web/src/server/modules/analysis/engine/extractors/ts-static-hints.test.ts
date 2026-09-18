import { describe, expect, it } from "vitest";

import { collectTypeScriptStaticHints } from "./ts-static-hints";

describe("collectTypeScriptStaticHints", () => {
  it("detects explicit any in code while ignoring comments", () => {
    const code = `
const a: any = 1;
// const b: any = 2;
/* const c: any = 3; */
`;
    const hints = collectTypeScriptStaticHints([{ content: code, path: "src/sample.ts" }]);
    const anyHints = hints.filter((h) => h.kind === "explicit-any");

    expect(anyHints).toHaveLength(1);
    expect(anyHints[0]?.line).toBe(2);
  });

  it("detects functions with excessive parameters", () => {
    const code = `function handler(a: string, b: number, c: boolean, d: object, e: string[], f: symbol, g: null) {}`;
    const hints = collectTypeScriptStaticHints([{ content: code, path: "src/handler.ts" }]);

    expect(hints.some((h) => h.kind === "many-params")).toBe(true);
  });
});
