import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks (must come before module imports) ──────────────────────────
const mocks = vi.hoisted(() => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
  buildRequestStore: vi.fn((o: unknown) => ({
    method: (o as { method?: string }).method ?? "GET",
    path: (o as { path?: string }).path ?? "/",
    requestId: "req-x",
    userId: undefined,
    userRole: undefined,
  })),
  prisma: {},
  redisClient: null as unknown,
  requestContext: {
    getStore: vi.fn<() => unknown>(() => null),
    run: vi.fn(),
  },
  verifyAndUseApiKey: vi.fn(),
}));

vi.mock("@/server/core/auth", () => ({ auth: mocks.auth }));
vi.mock("@/server/utils/request-context", () => ({
  buildRequestStore: mocks.buildRequestStore,
  requestContext: mocks.requestContext,
}));
vi.mock("@/server/utils/verify-and-use-api-key", () => ({
  verifyAndUseApiKey: mocks.verifyAndUseApiKey,
}));
vi.mock("../db", () => ({ prisma: mocks.prisma }));
vi.mock("../redis", () => ({ redisClient: mocks.redisClient }));

// ── Imports (after mocks) ────────────────────────────────────────────────────
import { createContext } from "./context";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(headers: Record<string, string> = {}) {
  const h = new Headers(headers);
  return {
    headers: {
      get: (name: string) => h.get(name),
    },
    method: "GET",
    nextUrl: { pathname: "/" },
  } as never;
}

describe("createContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requestContext.getStore.mockReturnValue(null);
  });

  it("builds store and calls getSession when no auth header", async () => {
    mocks.auth.api.getSession.mockResolvedValue(null);

    const ctx = await createContext({ req: makeReq() });

    expect(mocks.buildRequestStore).toHaveBeenCalledOnce();
    expect(mocks.buildRequestStore).toHaveBeenCalledWith(
      expect.objectContaining({ method: "GET", path: "/" }),
    );
    expect(mocks.auth.api.getSession).toHaveBeenCalledWith({
      headers: expect.anything(),
    });
    expect(ctx.session).toBeNull();
    expect(ctx.prisma).toBe(mocks.prisma);
  });

  it("uses Bearer token via verifyAndUseApiKey", async () => {
    const keyRecord = {
      user: {
        email: "a@b.c",
        id: 3,
        image: null,
        name: "A",
        role: "USER",
      },
    };
    mocks.verifyAndUseApiKey.mockResolvedValue(keyRecord);

    const ctx = await createContext({
      req: makeReq({ authorization: "Bearer sk-test-123" }),
    });

    expect(mocks.verifyAndUseApiKey).toHaveBeenCalledWith("sk-test-123");
    expect(ctx.session).not.toBeNull();
    expect(ctx.session?.user.id).toBe("3");
    expect(ctx.session?.user.email).toBe("a@b.c");
    expect(ctx.session?.user.role).toBe("USER");
    // getSession should NOT have been called when API key resolves
    expect(mocks.auth.api.getSession).not.toHaveBeenCalled();
  });

  it("falls back to getSession when verifyAndUseApiKey returns null", async () => {
    mocks.verifyAndUseApiKey.mockResolvedValue(null);
    mocks.auth.api.getSession.mockResolvedValue(null);

    const ctx = await createContext({
      req: makeReq({ authorization: "Bearer sk-bad-token" }),
    });

    expect(mocks.verifyAndUseApiKey).toHaveBeenCalledWith("sk-bad-token");
    expect(mocks.auth.api.getSession).toHaveBeenCalled();
    expect(ctx.session).toBeNull();
  });

  it("returns session from getSession with user", async () => {
    const sessionData = {
      session: { expiresAt: new Date(), id: "sess-1", token: "tok", userId: "7" },
      user: { email: "u@x.y", id: "7", image: null, name: "U", role: "USER" },
    };
    mocks.auth.api.getSession.mockResolvedValue(sessionData);

    const ctx = await createContext({ req: makeReq() });

    expect(ctx.session).toEqual(sessionData);
    expect(ctx.session?.user.id).toBe("7");
  });

  it("reuses existing store when requestContext.getStore returns one", async () => {
    const existingStore = {
      method: "GET",
      path: "/",
      requestId: "req-existing",
      userId: undefined,
    };
    mocks.requestContext.getStore.mockReturnValue(existingStore);
    mocks.auth.api.getSession.mockResolvedValue(null);

    const ctx = await createContext({ req: makeReq() });

    expect(mocks.buildRequestStore).not.toHaveBeenCalled();
    expect(ctx.requestInfo).toBe(existingStore);
  });

  it("includes prisma and redis in returned context", async () => {
    mocks.auth.api.getSession.mockResolvedValue(null);

    const ctx = await createContext({ req: makeReq() });

    expect(ctx.prisma).toBe(mocks.prisma);
    expect(ctx.redis).toBe(mocks.redisClient);
  });
});
