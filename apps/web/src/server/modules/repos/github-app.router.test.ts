import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appLogger: {
    debug: vi.fn(),
    error: vi.fn(),
    flush: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  enhance: vi.fn((db: unknown) => db),
  githubAppService: {
    getInstallUrl: vi.fn(),
    getMyRepos: vi.fn(),
    saveInstallation: vi.fn(),
  },
}));

vi.mock("@/server/core/app-logger", () => ({ appLogger: mocks.appLogger }));
vi.mock("@zenstackhq/runtime", () => ({ enhance: mocks.enhance }));
vi.mock("@/server/utils/request-context", () => ({
  buildRequestStore: vi.fn((o: unknown) => ({ ...(o as object), requestId: "req-1" })),
  requestContext: {
    getStore: vi.fn(() => null),
    run: vi.fn((_s: unknown, fn: () => unknown) => fn()),
  },
  resolveRequestId: vi.fn(() => "req-1"),
}));
vi.mock("@/shared/config/env.flags", () => ({ IS_PROD: false }));
vi.mock("@/server/core/github/github-app.service", () => ({
  githubAppService: mocks.githubAppService,
}));

import { createCallerFactory } from "@/server/core/trpc/init";

import { githubAppRouter } from "./github-app.router";

const createCaller = createCallerFactory(githubAppRouter);

function makeCtx() {
  const prisma = {};
  const ctx = {
    db: {},
    prisma,
    redis: null,
    req: {},
    requestInfo: {},
    session: { user: { id: "4" } },
  };
  return { caller: createCaller(ctx as never), prisma };
}

describe("githubAppRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getGithubInstallUrl returns the URL from the service", async () => {
    mocks.githubAppService.getInstallUrl.mockResolvedValue(
      "https://github.com/apps/doxynix/installations/new",
    );
    const { caller, prisma } = makeCtx();

    await expect(caller.getGithubInstallUrl({})).resolves.toBe(
      "https://github.com/apps/doxynix/installations/new",
    );
    expect(mocks.githubAppService.getInstallUrl).toHaveBeenCalledWith(prisma, 4);
  });

  it("getMyGithubRepos passes db, prisma and user id to the service", async () => {
    mocks.githubAppService.getMyRepos.mockResolvedValue([
      { full_name: "acme/repo", id: 1 },
      { full_name: "acme/other", id: 2 },
    ]);
    const { caller, prisma } = makeCtx();

    const result = await caller.getMyGithubRepos({});
    expect(result).toHaveLength(2);
    // ctx.db is overwritten by withZenStack to enhance(ctx.prisma); both are the same reference.
    expect(mocks.githubAppService.getMyRepos).toHaveBeenCalledWith(prisma, prisma, 4);
  });

  it("saveInstallation persists a valid installation", async () => {
    mocks.githubAppService.saveInstallation.mockResolvedValue({ success: true });
    const { caller, prisma } = makeCtx();

    await expect(caller.saveInstallation({ installationId: "123", state: "xyz" })).resolves.toEqual(
      { success: true },
    );
    expect(mocks.githubAppService.saveInstallation).toHaveBeenCalledWith(prisma, 4, "123", "xyz");
  });

  it("saveInstallation rejects a non-numeric installationId", async () => {
    const { caller } = makeCtx();

    await expect(
      caller.saveInstallation({ installationId: "abc", state: "xyz" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.githubAppService.saveInstallation).not.toHaveBeenCalled();
  });

  it("saveInstallation rejects a blank state", async () => {
    const { caller } = makeCtx();

    await expect(caller.saveInstallation({ installationId: "1", state: "" })).rejects.toMatchObject(
      { code: "BAD_REQUEST" },
    );
    expect(mocks.githubAppService.saveInstallation).not.toHaveBeenCalled();
  });
});
