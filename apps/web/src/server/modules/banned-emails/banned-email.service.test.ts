import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { bannedEmailService } from "./banned-email.service";

function makeDb() {
  const create = vi.fn().mockResolvedValue({
    createdAt: new Date("2026-01-01"),
    email: "spam@example.com",
    id: "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d",
    reason: "MANUAL",
  });
  // `create` revokes live sessions after the insert, which looks up the account by hash first.
  const findUser = vi.fn().mockResolvedValue(null);
  const db = {
    bannedEmail: { count: vi.fn(), create, delete: vi.fn(), findMany: vi.fn() },
    user: { findUnique: findUser },
  };

  return { create, db: db as never, findUser };
}

describe("bannedEmailService.buildWhereClause", () => {
  it("returns an empty clause for an unfiltered request", () => {
    expect(bannedEmailService.buildWhereClause({})).toEqual({});
  });

  it("passes the reason filter straight through", () => {
    expect(bannedEmailService.buildWhereClause({ reason: "BOUNCED" })).toEqual({
      reason: "BOUNCED",
    });
  });

  it("searches the email case-insensitively and ignores a blank term", () => {
    expect(bannedEmailService.buildWhereClause({ search: "  Spam@Example.com " })).toEqual({
      email: { contains: "spam@example.com", mode: "insensitive" },
    });
    expect(bannedEmailService.buildWhereClause({ search: "   " })).toEqual({});
  });
});

describe("bannedEmailService.create", () => {
  it("normalizes the address before storing it, so a plus-tag cannot dodge the block", async () => {
    const { create, db } = makeDb();

    await bannedEmailService.create(db, { email: "  User+spam@GoogleMail.com " });

    expect(create.mock.calls[0]?.[0]).toMatchObject({
      data: { email: "user@gmail.com", reason: "MANUAL" },
    });
  });

  it("defaults the reason so an unclassified block is still explicit", async () => {
    const { create, db } = makeDb();

    await bannedEmailService.create(db, { email: "spam@example.com" });

    expect(create.mock.calls[0]?.[0]).toMatchObject({ data: { reason: "MANUAL" } });
  });

  it("keeps a supplied reason", async () => {
    const { create, db } = makeDb();

    await bannedEmailService.create(db, { email: "spam@example.com", reason: "BOUNCED" });

    expect(create.mock.calls[0]?.[0]).toMatchObject({ data: { reason: "BOUNCED" } });
  });

  it("looks up accounts by the derived hash, so it revokes live sessions of the blocked address", async () => {
    const { db, findUser } = makeDb();

    await bannedEmailService.create(db, { email: "Spam@Example.com" });

    expect(findUser).toHaveBeenCalledWith(
      expect.objectContaining({ select: { id: true }, where: { emailHash: expect.any(String) } }),
    );
  });

  it("never asks the caller for the hash column, which is @omit and derived on write", async () => {
    const { create, db } = makeDb();

    await bannedEmailService.create(db, { email: "spam@example.com" });

    expect(create.mock.calls[0]?.[0].data).not.toHaveProperty("emailHash");
    expect(create.mock.calls[0]?.[0].select).not.toHaveProperty("emailHash");
  });
});

describe("bannedEmailService.remove", () => {
  it("reports a missing row as NOT_FOUND rather than surfacing a raw Prisma code", async () => {
    const missing = new Prisma.PrismaClientKnownRequestError("Record to delete does not exist", {
      clientVersion: "6",
      code: "P2025",
    });
    const db = { bannedEmail: { delete: vi.fn().mockRejectedValue(missing) } } as never;

    await expect(bannedEmailService.remove(db, "missing")).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Banned email not found",
    });
  });
});
