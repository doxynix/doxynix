import { describe, expect, it } from "vitest";

import { BannedEmailCreateSchema, BannedEmailFilterSchema } from "./banned-email.schemas";

describe("BannedEmailCreateSchema", () => {
  it("accepts a known reason and defaults the rest", () => {
    expect(BannedEmailCreateSchema.parse({ email: "spam@example.com", reason: "MANUAL" })).toEqual({
      email: "spam@example.com",
      reason: "MANUAL",
    });
  });

  it("treats the reason as optional so a moderator can ban an address before classifying it", () => {
    expect(BannedEmailCreateSchema.safeParse({ email: "spam@example.com" }).success).toBe(true);
  });

  it("rejects a reason outside the enum rather than storing it verbatim", () => {
    expect(
      BannedEmailCreateSchema.safeParse({ email: "spam@example.com", reason: "SPAM" }).success,
    ).toBe(false);
  });

  it("rejects anything that is not an email", () => {
    expect(BannedEmailCreateSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
    expect(BannedEmailCreateSchema.safeParse({}).success).toBe(false);
  });
});

describe("BannedEmailFilterSchema", () => {
  it("carries the shared pagination defaults and an optional reason", () => {
    expect(BannedEmailFilterSchema.parse({})).toMatchObject({ limit: 10 });
    expect(BannedEmailFilterSchema.safeParse({ reason: "BOUNCED" }).success).toBe(true);
    expect(BannedEmailFilterSchema.safeParse({ reason: "NOPE" }).success).toBe(false);
  });
});
