import { describe, expect, it } from "vitest";

import {
  AdminDeleteUserSchema,
  AdminSetBannedSchema,
  AdminUsersFilterSchema,
} from "./admin-user.schemas";

const USER_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
const FUTURE = new Date(Date.now() + 86_400_000);
const CODE = "123456";

describe("AdminSetBannedSchema", () => {
  it("accepts a ban with a reason and an expiry", () => {
    const parsed = AdminSetBannedSchema.safeParse({
      banExpires: FUTURE,
      banned: true,
      banReason: "spam reports",
      code: CODE,
      id: USER_ID,
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts a ban without either optional field, so the panel can ban in one click", () => {
    expect(AdminSetBannedSchema.safeParse({ banned: true, code: CODE, id: USER_ID }).success).toBe(
      true,
    );
  });

  it("requires a confirmation code to ban, so the dialog cannot be skipped", () => {
    const parsed = AdminSetBannedSchema.safeParse({ banned: true, id: USER_ID });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(["code"]);
  });

  it("requires no code to un-ban, which has to stay reachable while locked out of the authenticator", () => {
    expect(AdminSetBannedSchema.safeParse({ banned: false, id: USER_ID }).success).toBe(true);
  });

  it("rejects a reason or an expiry attached to an un-ban, where they mean nothing", () => {
    const withReason = AdminSetBannedSchema.safeParse({
      banned: false,
      banReason: "oops",
      id: USER_ID,
    });
    const withExpiry = AdminSetBannedSchema.safeParse({
      banExpires: FUTURE,
      banned: false,
      id: USER_ID,
    });

    expect(withReason.success).toBe(false);
    expect(withReason.error?.issues[0]?.path).toEqual(["banned"]);
    expect(withExpiry.success).toBe(false);
  });

  it("trims and caps the reason so the audit payload stays bounded", () => {
    const parsed = AdminSetBannedSchema.safeParse({
      banned: true,
      banReason: `  ${"x".repeat(600)}  `,
      code: CODE,
      id: USER_ID,
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects a non-uuid id before the service ever reaches the database", () => {
    expect(
      AdminSetBannedSchema.safeParse({ banned: true, code: CODE, id: "not-a-uuid" }).success,
    ).toBe(false);
  });
});

describe("AdminDeleteUserSchema", () => {
  it("keeps the id required and adds the confirmation code as optional, so the service can reject it", () => {
    expect(AdminDeleteUserSchema.safeParse({ id: USER_ID }).success).toBe(true);
    expect(AdminDeleteUserSchema.safeParse({ code: CODE, id: USER_ID }).success).toBe(true);
    expect(AdminDeleteUserSchema.safeParse({ code: CODE, id: "nope" }).success).toBe(false);
  });
});

describe("AdminUsersFilterSchema", () => {
  it("defaults the page size so a client cannot request the whole table", () => {
    expect(AdminUsersFilterSchema.parse({}).limit).toBe(10);
  });

  it("accepts role and banned filters and rejects anything outside the enums", () => {
    expect(AdminUsersFilterSchema.parse({ banned: true, role: "ADMIN" })).toMatchObject({
      banned: true,
      role: "ADMIN",
    });
    expect(AdminUsersFilterSchema.safeParse({ role: "OWNER" }).success).toBe(false);
    expect(AdminUsersFilterSchema.safeParse({ banned: "yes" }).success).toBe(false);
  });
});
