import { describe, expect, it } from "vitest";

import { isSchemaMismatchError } from "./schema-mismatch";

describe("isSchemaMismatchError", () => {
  it("recognizes schema mismatch error signatures", () => {
    expect(isSchemaMismatchError(new Error("Output did not match schema for object"))).toBe(true);
    expect(isSchemaMismatchError(new Error("No object generated"))).toBe(true);

    const aiError = new Error("boom");
    aiError.name = "AI_NoObjectGeneratedError";
    expect(isSchemaMismatchError(aiError)).toBe(true);

    const noOutputError = new Error("boom");
    noOutputError.name = "AI_NoOutputGeneratedError";
    expect(isSchemaMismatchError(noOutputError)).toBe(true);
  });

  it("rejects unrelated errors and non-error values", () => {
    expect(isSchemaMismatchError(new Error("disk full"))).toBe(false);
    expect(isSchemaMismatchError(new SyntaxError("bad json"))).toBe(false);
    expect(isSchemaMismatchError(new TypeError("nope"))).toBe(false);
    expect(isSchemaMismatchError("did not match schema")).toBe(false);
    expect(isSchemaMismatchError(undefined)).toBe(false);
    expect(isSchemaMismatchError({})).toBe(false);
  });
});
