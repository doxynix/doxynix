import type * as TimersPromises from "node:timers/promises";

import { Prisma } from "@prisma/client";
import type { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";
import { assertCanDisconnectAccount, userService } from "@/server/modules/users/user.service";

const LAST_AUTH_METHOD_MESSAGE =
  "You cannot disconnect your only authentication method. Add another one first.";

const BASE_MS = 20;
const JITTER_MS = 10;
const USER_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";

const { sleepCalls } = vi.hoisted(() => ({ sleepCalls: [] as number[] }));

const { authMock } = vi.hoisted(() => ({
  authMock: {
    listSessions: vi.fn(),
    revokeSession: vi.fn(),
  },
}));

vi.mock("@/server/core/auth", () => ({
  auth: { api: authMock },
}));

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
  const HEADERS = new Headers({ cookie: "session=whatever" });

  const OWN_SESSION = {
    createdAt: new Date("2026-03-01T12:00:00Z"),
    id: "018f0000-0000-7000-8000-0000000000a1",
    token: "own-token-value",
  };
  const OTHER_SESSION = {
    createdAt: new Date("2026-03-02T12:00:00Z"),
    id: "018f0000-0000-7000-8000-0000000000a2",
    token: "other-token-value",
  };

  function mockAuth(sessions: unknown[]) {
    authMock.listSessions.mockResolvedValue(sessions);
    authMock.revokeSession.mockResolvedValue({ success: true });
  }

  beforeEach(() => {
    authMock.listSessions.mockReset();
    authMock.revokeSession.mockReset();
  });

  it("resolves the token server-side and revokes the matching session", async () => {
    mockAuth([OWN_SESSION, OTHER_SESSION]);

    await expect(userService.revokeSession(HEADERS, OTHER_SESSION.id)).resolves.toEqual({
      success: true,
    });

    expect(authMock.revokeSession).toHaveBeenCalledWith({
      body: { token: OTHER_SESSION.token },
      headers: HEADERS,
    });
  });

  it("refuses an unknown session id and never reaches the revoke call", async () => {
    mockAuth([OWN_SESSION]);

    await expect(
      userService.revokeSession(HEADERS, "018f0000-0000-7000-8000-00000000dead"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(authMock.revokeSession).not.toHaveBeenCalled();
  });
});
