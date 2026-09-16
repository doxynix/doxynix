import { describe, expect, it } from "vitest";

import { hasText, isEmpty, uniqueObjectPaths } from "./string-utils";

describe("string utils", () => {
  it("detects empty and whitespace-only strings correctly", () => {
    expect(hasText("hello")).toBe(true);
    expect(hasText("   ")).toBe(false);
    expect(isEmpty(" ")).toBe(true);
    expect(isEmpty("value")).toBe(false);
  });

  it("deduplicates object paths after normalizing them", () => {
    const items = [{ path: "src/./a.ts" }, { path: "src/a.ts" }, { path: "src/b.ts" }];

    expect(uniqueObjectPaths(items)).toEqual(["src/a.ts", "src/b.ts"]);
  });
});
