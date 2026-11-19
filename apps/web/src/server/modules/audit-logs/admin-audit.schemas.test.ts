import { AuditModel, AuditOperation, CursorMetaSchema } from "@doxynix/shared";
import { describe, expect, it } from "vitest";

import { AdminAuditFilterSchema, AdminAuditListSchema } from "./admin-audit.schemas";

const CURSOR = "0192f0aa-2222-7000-8000-000000000002";

describe("AdminAuditFilterSchema", () => {
  it("defaults the page size to the cursor page the table sends", () => {
    expect(AdminAuditFilterSchema.parse({}).limit).toBe(50);
  });

  it("takes a cursor instead of a page number", () => {
    expect(AdminAuditFilterSchema.parse({ cursor: CURSOR }).cursor).toBe(CURSOR);
    expect(AdminAuditFilterSchema.parse({ page: 3 })).not.toHaveProperty("page");
  });

  it("keeps every filter the admin table offers", () => {
    const parsed = AdminAuditFilterSchema.parse({
      actorId: "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d",
      from: "2026-01-01",
      model: AuditModel.Repo,
      operation: AuditOperation.UPDATE,
      search: "  req-1 ",
      to: "2026-02-01",
    });

    expect(parsed).toMatchObject({
      model: AuditModel.Repo,
      operation: AuditOperation.UPDATE,
      search: "req-1",
    });
    expect(parsed.from).toEqual(new Date("2026-01-01"));
  });

  it("rejects an inverted date range", () => {
    expect(AdminAuditFilterSchema.safeParse({ from: "2026-02-01", to: "2026-01-01" }).success).toBe(
      false,
    );
  });
});

describe("AdminAuditListSchema", () => {
  it("carries cursor meta instead of offset counts", () => {
    const parsed = AdminAuditListSchema.parse({
      items: [],
      meta: { hasNextPage: true, nextCursor: CURSOR },
    });

    expect(parsed.meta).toEqual({ hasNextPage: true, nextCursor: CURSOR });
    expect(CursorMetaSchema.safeParse(parsed.meta).success).toBe(true);
  });
});
