import { describe, expect, it } from "vitest";

import { safeJsonClone } from "./safe-json";

describe("safeJsonClone", () => {
  it("should clone a simple object", () => {
    const obj = { a: 1, b: "string" };
    const cloned = safeJsonClone(obj);
    expect(cloned).toEqual(obj);
    expect(cloned).not.toBe(obj);
  });

  it("should handle BigInt serialization", () => {
    const obj = { val: 100n };
    const cloned = safeJsonClone(obj);
    expect(cloned).toEqual({ val: "100" });
  });

  it("should handle circular references", () => {
    const obj: any = { a: 1 };
    obj.self = obj;
    const cloned = safeJsonClone(obj);
    expect(cloned).toEqual({ a: 1, self: "[Circular]" });
  });

  it("should handle null values correctly", () => {
    const obj = { a: null };
    const cloned = safeJsonClone(obj);
    expect(cloned).toEqual({ a: null });
  });
});
