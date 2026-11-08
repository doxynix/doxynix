import { describe, expect, it } from "vitest";

import { createMagicLinkSchema } from "./magic-link";

const schema = createMagicLinkSchema("invalid email", "email too long");

describe("createMagicLinkSchema", () => {
  it("accepts a valid email", () => {
    expect(schema.safeParse({ email: "user@example.com" }).success).toBe(true);
  });

  it("rejects a malformed email", () => {
    expect(schema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });

  it("rejects an email longer than 254 characters", () => {
    expect(schema.safeParse({ email: `${"a".repeat(250)}@b.co` }).success).toBe(false);
  });
});
