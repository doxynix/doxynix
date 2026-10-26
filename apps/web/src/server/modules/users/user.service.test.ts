import type * as TimersPromises from "node:timers/promises";

import { Prisma } from "@prisma/client";
import type { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as DbModule from "@/server/core/db";
import type { DbClient } from "@/server/core/db";
import { assertCanDisconnectAccount, userService } from "@/server/modules/users/user.service";

const LAST_AUTH_METHOD_MESSAGE =
  "You cannot disconnect your only authentication method. Add another one first.";

const BASE_MS = 20;
const JITTER_MS = 10;
const USER_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";

const { sleepCalls } = vi.hoisted(() => ({ sleepCalls: [] as number[] }));

const { authMock, prismaMock } = vi.hoisted(() => ({
  authMock: {
    deleteSession: vi.fn(),
    listSessions: vi.fn(),
    revokeSession: vi.fn(),
  },
  prismaMock: {
    session: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/server/core/auth", () => ({
  auth: {
    $context: Promise.resolve({ internalAdapter: { deleteSession: authMock.deleteSession } }),
    api: authMock,
  },
}));

vi.mock("@/server/core/db", async (importOriginal) => {
  const actual = await importOriginal<typeof DbModule>();

  return { ...actual, prisma: prismaMock };
});

vi.mock("node:timers/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof TimersPromises>();

  return {
    ...actual,
    setTimeout: (ms: number) => {
      sleepCalls.push(ms);
      return actual.setTimeout(0);
    },
  };
});

function writeConflict() {
  return new Prisma.PrismaClientKnownRequestError(
    "Transaction failed due to a write conflict or a deadlock",
    { clientVersion: Prisma.prismaVersion.client, code: "P2034" },
  );
}

function conflictThenSucceed(conflicts: number) {
  let remaining = conflicts;
  const transactionOptions: unknown[] = [];

  const db = {
    $transaction(_body: never, options: never) {
      transactionOptions.push(options);

      if (remaining > 0) {
        remaining -= 1;
        return Promise.reject(writeConflict());
      }

      return Promise.resolve();
    },
  } as unknown as DbClient;

  return { db, transactionOptions };
}

function recordedPair(): [number, number] {
  expect(sleepCalls).toHaveLength(2);

  const [first, second] = sleepCalls;
  if (first == null || second == null) {
    throw new Error("expected two recorded retry delays");
  }

  return [first, second];
}

function recordedDelay(): number {
  expect(sleepCalls).toHaveLength(1);

  const [first] = sleepCalls;
  if (first == null) {
    throw new Error("expected one recorded retry delay");
  }

  return first;
}

function captureError(run: () => void): TRPCError {
  try {
    run();
  } catch (error) {
    return error as TRPCError;
  }

  throw new Error("expected assertCanDisconnectAccount to throw");
}

describe("assertCanDisconnectAccount", () => {
  it("rejects disconnecting the only linked account when the email is not verified", () => {
    const error = captureError(() =>
      assertCanDisconnectAccount({ accountCount: 1, hasEmailAuth: false }),
    );

    expect(error.code).toBe("BAD_REQUEST");
    expect(error.message).toBe(LAST_AUTH_METHOD_MESSAGE);
  });

  it("rejects when the user has no linked accounts and no verified email", () => {
    expect(() => assertCanDisconnectAccount({ accountCount: 0, hasEmailAuth: false })).toThrow(
      LAST_AUTH_METHOD_MESSAGE,
    );
  });

  it("allows disconnecting the only linked account when the email is verified", () => {
    expect(() => assertCanDisconnectAccount({ accountCount: 1, hasEmailAuth: true })).not.toThrow();
  });

  it("allows disconnecting when another linked account remains", () => {
    expect(() =>
      assertCanDisconnectAccount({ accountCount: 2, hasEmailAuth: false }),
    ).not.toThrow();
  });
});

describe("disconnectAccount: P2034 backoff", () => {
  beforeEach(() => {
    sleepCalls.length = 0;
  });

  it("grows the delay on each successive retry instead of sleeping a constant", async () => {
    const { db, transactionOptions } = conflictThenSucceed(2);

    await expect(userService.disconnectAccount(db, USER_ID, "github")).resolves.toEqual({
      success: true,
    });

    const [firstDelay, secondDelay] = recordedPair();
    expect(firstDelay).toBeGreaterThanOrEqual(BASE_MS);
    expect(firstDelay).toBeLessThan(BASE_MS + JITTER_MS);
    expect(secondDelay).toBeGreaterThanOrEqual(BASE_MS * 2);
    expect(secondDelay).toBeLessThan(BASE_MS * 2 + JITTER_MS);

    expect(secondDelay).toBeGreaterThan(firstDelay);

    expect(transactionOptions).toEqual([
      { isolationLevel: "Serializable" },
      { isolationLevel: "Serializable" },
      { isolationLevel: "Serializable" },
    ]);
  });

  it("jitters the delay so concurrent double-clicks do not retry in lockstep", async () => {
    const firstDelays: number[] = [];

    for (let run = 0; run < 24; run++) {
      sleepCalls.length = 0;
      const { db } = conflictThenSucceed(1);

      await userService.disconnectAccount(db, USER_ID, "github");

      const delay = recordedDelay();
      firstDelays.push(delay);
    }

    expect(new Set(firstDelays).size).toBeGreaterThan(1);
  });
});

describe("revokeSession", () => {
  const USER_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";

  const OWN_SESSION = {
    id: "018f0000-0000-7000-8000-0000000000a1",
    token: "own-token-value",
  };
  const OTHER_SESSION = {
    id: "018f0000-0000-7000-8000-0000000000a2",
    token: "other-token-value",
  };
  beforeEach(() => {
    authMock.deleteSession.mockReset();
    prismaMock.session.findFirst.mockReset();
  });

  it("deletes the matching session so it leaves the sessions list", async () => {
    prismaMock.session.findFirst.mockResolvedValue(OTHER_SESSION);

    await expect(userService.revokeSession(USER_ID, OTHER_SESSION.id)).resolves.toEqual({
      success: true,
    });

    expect(prismaMock.session.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: OTHER_SESSION.id, userId: USER_ID } }),
    );
    expect(authMock.deleteSession).toHaveBeenCalledWith(OTHER_SESSION.token);
  });

  it("scopes the lookup to the caller, so another user's session is never revoked", async () => {
    prismaMock.session.findFirst.mockResolvedValue(null);

    await expect(userService.revokeSession(USER_ID, OWN_SESSION.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    expect(authMock.deleteSession).not.toHaveBeenCalled();
  });

  it("refuses an unknown session id and never reaches the delete call", async () => {
    prismaMock.session.findFirst.mockResolvedValue(null);

    await expect(
      userService.revokeSession(USER_ID, "018f0000-0000-7000-8000-00000000dead"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(authMock.deleteSession).not.toHaveBeenCalled();
  });
});

describe("revokeOtherSessions", () => {
  const USER_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
  const CURRENT_SESSION_ID = "018f0000-0000-7000-8000-0000000000a1";

  it("deletes every session except the current one", async () => {
    const other = { id: "018f0000-0000-7000-8000-0000000000a2", token: "other-token" };
    prismaMock.session.findMany.mockResolvedValue([other]);

    await expect(userService.revokeOtherSessions(USER_ID, CURRENT_SESSION_ID)).resolves.toEqual({
      success: true,
    });

    expect(prismaMock.session.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { not: CURRENT_SESSION_ID }, userId: USER_ID },
      }),
    );
    expect(authMock.deleteSession).toHaveBeenCalledWith(other.token);
  });
});

describe("getActiveSessions", () => {
  const USER_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";

  function mockDb(sessions: unknown[]) {
    const findMany = vi.fn().mockResolvedValue(sessions);

    return { db: { session: { findMany } } as unknown as DbClient, findMany };
  }

  it("reads the sessions of the user from the database", async () => {
    const createdAt = new Date("2026-03-01T12:00:00Z");
    const { db, findMany } = mockDb([
      { createdAt, id: "session-1", ipAddress: "127.0.0.1", userAgent: "internal" },
    ]);

    await expect(userService.getActiveSessions(db, USER_ID, false)).resolves.toEqual([
      {
        createdAt,
        id: "session-1",
        ipAddress: "127.0.0.1",
        userAgent: "System",
      },
    ]);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        where: { expiresAt: { gt: expect.any(Date) }, userId: USER_ID },
      }),
    );
  });

  it("excludes expired sessions", async () => {
    const { db, findMany } = mockDb([]);

    await userService.getActiveSessions(db, USER_ID, false);

    const where = findMany.mock.calls[0]?.[0]?.where as { expiresAt: { gt: Date } };
    expect(where.expiresAt.gt).toBeInstanceOf(Date);
  });

  it("returns nothing for an API-key session, which has no session row", async () => {
    const { db, findMany } = mockDb([]);

    await expect(userService.getActiveSessions(db, USER_ID, true)).resolves.toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
