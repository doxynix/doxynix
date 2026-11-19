import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock("@/server/core/db", () => ({ prisma: { account: { findFirst } } }));
vi.mock("@/server/core/app-logger", () => ({
  appLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { buildRequestStore, requestContext } from "@/server/utils/request-context";

import { githubTokenService } from "./github-access-token";

const USER_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";

function freshToken() {
  return {
    accessToken: "access-token-value",
    accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    id: "account-1",
    refreshToken: "refresh-token-value",
  };
}

function makeStore() {
  return buildRequestStore({
    method: "POST",
    path: "/api/trpc",
    req: new Request("http://localhost/api/trpc"),
  });
}

describe("githubTokenService.getValidToken", () => {
  beforeEach(() => {
    findFirst.mockReset();
    findFirst.mockResolvedValue(freshToken());
  });

  it("reads the token once per request store", async () => {
    const [first, second] = await requestContext.run(makeStore(), () =>
      Promise.all([
        githubTokenService.getValidToken(USER_ID),
        githubTokenService.getValidToken(USER_ID),
      ]),
    );

    expect(first).toBe("access-token-value");
    expect(second).toBe("access-token-value");
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it("reads again outside a request store", async () => {
    await githubTokenService.getValidToken(USER_ID);
    await githubTokenService.getValidToken(USER_ID);

    expect(findFirst).toHaveBeenCalledTimes(2);
  });

  it("keeps one entry per user inside the same store", async () => {
    await requestContext.run(makeStore(), () =>
      Promise.all([
        githubTokenService.getValidToken(USER_ID),
        githubTokenService.getValidToken("0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e"),
      ]),
    );

    expect(findFirst).toHaveBeenCalledTimes(2);
  });
});
