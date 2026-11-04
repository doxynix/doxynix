import { describe, expect, it } from "vitest";

import { MessageCode, MessageCodeSchema } from "./index";

describe("MessageCode", () => {
  it("maps every key to itself so the wire value is stable", () => {
    for (const [key, value] of Object.entries(MessageCode)) {
      expect(value).toBe(key);
    }
  });

  it("has no duplicate values", () => {
    const values = Object.values(MessageCode);
    expect(new Set(values).size).toBe(values.length);
  });

  it("accepts every code through the schema", () => {
    for (const value of Object.values(MessageCode)) {
      expect(MessageCodeSchema.safeParse(value).success).toBe(true);
    }
  });

  it("uses SCREAMING_SNAKE_CASE only", () => {
    for (const value of Object.values(MessageCode)) {
      expect(value).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });
});
