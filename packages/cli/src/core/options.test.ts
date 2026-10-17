import { describe, expect, it } from "vitest";

import { OptionValidationError, parseBoundedInt } from "./options";

describe("parseBoundedInt", () => {
  it("floors a fractional value", () => {
    expect(parseBoundedInt("1.5", 20, { max: 100 }, "--limit")).toBe(1);
  });

  it("clamps above the maximum", () => {
    expect(parseBoundedInt("999", 20, { max: 100 }, "--limit")).toBe(100);
  });

  it("rejects a non-numeric value", () => {
    expect(() => parseBoundedInt("abc", 20, { max: 100 }, "--limit")).toThrow(
      OptionValidationError,
    );
  });

  it("rejects a zero page number", () => {
    expect(() => parseBoundedInt("0", 1, { max: 100, min: 1 }, "--page")).toThrow(
      OptionValidationError,
    );
  });

  it("falls back when the flag is absent", () => {
    expect(parseBoundedInt(undefined, 20, { max: 100 }, "--limit")).toBe(20);
  });
});
