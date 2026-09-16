import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  getInstallationInfo: vi.fn(),
  getMyReposFromApi: vi.fn(),
  getNormalizedHash: vi.fn((value: string) => `hash:${value}`),
  getPublicClient: vi.fn(),
  getRawHash: vi.fn((value: string) => `raw:${value}`),
  githubTokenService: { getValidToken: vi.fn() },
  isOctokitError: vi.fn(),
}));

vi.mock("@/server/utils/handle-error", () => ({
  isOctokitError: mocks.isOctokitError,
}));

vi.mock("@/server/utils/hash", () => ({
  getNormalizedHash: mocks.getNormalizedHash,
  getRawHash: mocks.getRawHash,
}));

vi.mock("../app-logger", () => ({ appLogger: mocks.appLogger }));

vi.mock("./github-api", () => ({ getMyRepos: mocks.getMyReposFromApi }));

vi.mock("./github-provider", () => ({
  GitHubAuthRequiredError: class GitHubAuthRequiredError extends Error {},
  getInstallationInfo: mocks.getInstallationInfo,
  getPublicClient: mocks.getPublicClient,
}));

vi.mock("./github-token.service", () => ({
  githubTokenService: mocks.githubTokenService,
}));

vi.mock("@/shared/config/env.server", () => ({ GITHUB_APP_ID: "555" }));

vi.mock("node:crypto", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("node:crypto");
  const randomBytes = () => ({ toString: () => "state-from-crypto" });
  return {
    ...actual,
    default: { ...actual, randomBytes },
    randomBytes,
  };
});

import { githubAppService } from "./github-app.service";

function makeOctokit(installations: unknown[] = []) {
  return {
    paginate: vi.fn().mockResolvedValue(installations),
    rest: { apps: { listInstallationsForAuthenticatedUser: {} } },
  };
}

function makePrisma() {
  const tx = {
    githubInstallation: {
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    verification: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };

  const prisma = {
    $transaction: vi.fn((input: unknown) => {
      if (typeof input === "function") {
        return (input as (t: typeof tx) => unknown)(tx);
      }
      if (Array.isArray(input)) {
        return Promise.resolve(
          input.map((entry) => (typeof entry === "function" ? entry() : entry)),
        );
      }
      return Promise.resolve(undefined);
    }),
    githubInstallation: { upsert: vi.fn().mockResolvedValue({}) },
    verification: {
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  };

  return { prisma, tx };
}

function makeDb(installations: unknown[] = []) {
  return { githubInstallation: { findMany: vi.fn().mockResolvedValue(installations) } };
}

async function expectForbidden(promise: Promise<unknown>, message: RegExp) {
  const caughtError = await promise.catch((error: unknown) => error);
  expect(caughtError).toBeInstanceOf(TRPCError);
  expect(caughtError).toMatchObject({ code: "FORBIDDEN" });
  expect((caughtError as Error).message).toMatch(message);
}

describe("githubAppService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.githubTokenService.getValidToken.mockResolvedValue(null);
    mocks.getPublicClient.mockReturnValue(makeOctokit([]));
  });

  describe("getInstallUrl", () => {
    it("deletes previous verifications, stores the new state, and returns the install URL", async () => {
      const { prisma } = makePrisma();

      const url = await githubAppService.getInstallUrl(prisma as never, 5);

      expect(url).toBe("https://github.com/apps/doxynix/installations/new?state=state-from-crypto");
      expect(prisma.verification.deleteMany).toHaveBeenCalledWith({
        where: { identifierHash: "hash:github_install_5" },
      });
      expect(prisma.verification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            identifier: "github_install_5",
            value: "state-from-crypto",
          }),
        }),
      );
    });
  });

  describe("syncInstallations", () => {
    it("does nothing when there is no valid token", async () => {
      const { prisma } = makePrisma();

      await githubAppService.syncInstallations(prisma as never, 5);

      expect(mocks.getPublicClient).not.toHaveBeenCalled();
      expect(prisma.githubInstallation.upsert).not.toHaveBeenCalled();
    });

    it("upserts installations that belong to our GitHub app", async () => {
      const { prisma } = makePrisma();
      mocks.githubTokenService.getValidToken.mockResolvedValue("token");
      mocks.getPublicClient.mockReturnValue(
        makeOctokit([
          {
            account: { avatar_url: "a.png", id: 7, login: "octo" },
            app_id: 555,
            html_url: "https://github.com/apps/foo/installations/10",
            id: 10,
            repository_selection: "all",
            target_type: "User",
          },
        ]),
      );

      await githubAppService.syncInstallations(prisma as never, 5);

      expect(prisma.githubInstallation.upsert).toHaveBeenCalledTimes(1);
      expect(prisma.githubInstallation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            accountLogin: "octo",
            targetId: BigInt(7),
            userId: 5,
          }),
          where: { id: BigInt(10) },
        }),
      );
    });

    it("ignores installations of other GitHub apps", async () => {
      const { prisma } = makePrisma();
      mocks.githubTokenService.getValidToken.mockResolvedValue("token");
      mocks.getPublicClient.mockReturnValue(
        makeOctokit([{ account: { id: 7, login: "octo" }, app_id: 999, id: 20 }]),
      );

      await githubAppService.syncInstallations(prisma as never, 5);

      expect(prisma.githubInstallation.upsert).not.toHaveBeenCalled();
    });

    it("logs an error when pagination fails", async () => {
      const { prisma } = makePrisma();
      mocks.githubTokenService.getValidToken.mockResolvedValue("token");
      mocks.getPublicClient.mockReturnValue({
        paginate: vi.fn().mockRejectedValue(new Error("GitHub down")),
        rest: { apps: { listInstallationsForAuthenticatedUser: {} } },
      });

      await githubAppService.syncInstallations(prisma as never, 5);

      expect(mocks.appLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: "Failed to automatically sync/claim GitHub installations",
        }),
      );
      expect(prisma.githubInstallation.upsert).not.toHaveBeenCalled();
    });
  });

  describe("getMyRepos", () => {
    it("returns the missing oauth status when there are no installations and no token", async () => {
      const { prisma } = makePrisma();
      const db = makeDb([]);

      const result = await githubAppService.getMyRepos(db as never, prisma as never, 5);

      expect(result).toEqual({
        installationId: null,
        isConnected: false,
        items: [],
        manageUrl: null,
        oauthStatus: "missing",
      });
    });

    it("fetches and returns repositories when the token is valid", async () => {
      const { prisma } = makePrisma();
      const db = makeDb([]);
      mocks.githubTokenService.getValidToken.mockResolvedValue("token");
      mocks.getMyReposFromApi.mockResolvedValue([{ fullName: "a/b" }]);

      const result = await githubAppService.getMyRepos(db as never, prisma as never, 5);

      expect(result).toEqual({
        installations: [],
        isConnected: true,
        items: [{ fullName: "a/b" }],
        oauthStatus: "valid",
      });
    });

    it("returns empty items and logs an error when the repo fetch fails", async () => {
      const { prisma } = makePrisma();
      const db = makeDb([]);
      mocks.githubTokenService.getValidToken.mockResolvedValue("token");
      mocks.getMyReposFromApi.mockRejectedValue(new Error("GitHub down"));

      const result = await githubAppService.getMyRepos(db as never, prisma as never, 5);

      expect(result).toEqual({
        installations: [],
        isConnected: true,
        items: [],
        oauthStatus: "valid",
      });
      expect(mocks.appLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ msg: "Dashboard fetch failed", userId: 5 }),
      );
    });
  });

  describe("saveInstallation", () => {
    it("rejects an invalid or expired security state", async () => {
      const { prisma } = makePrisma();
      prisma.verification.findFirst.mockResolvedValue(null);

      await expectForbidden(
        githubAppService.saveInstallation(prisma as never, 5, "88", "state"),
        /Invalid, expired/,
      );
      expect(prisma.verification.deleteMany).not.toHaveBeenCalled();
    });

    it("rejects when the user has no linked GitHub account", async () => {
      const { prisma } = makePrisma();
      prisma.verification.findFirst.mockResolvedValue({ id: "v1" });

      await expectForbidden(
        githubAppService.saveInstallation(prisma as never, 5, "88", "state"),
        /must link your GitHub account/,
      );
      expect(mocks.getPublicClient).not.toHaveBeenCalled();
    });

    it("claims the installation inside a transaction on success", async () => {
      const { prisma, tx } = makePrisma();
      prisma.verification.findFirst.mockResolvedValue({ id: "v1" });
      mocks.githubTokenService.getValidToken.mockResolvedValue("token");
      mocks.getPublicClient.mockReturnValue(makeOctokit([{ id: 88 }]));
      mocks.getInstallationInfo.mockResolvedValue({
        account: { avatar_url: "av.png", login: "acme" },
        app_id: 555,
        html_url: "https://github.com/apps/foo/installations/88",
        repository_selection: "all",
        target_id: 42,
        target_type: "Organization",
      });

      const result = await githubAppService.saveInstallation(prisma as never, 5, "88", "state");

      expect(result).toEqual({ success: true });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(tx.verification.deleteMany).toHaveBeenCalledWith({
        where: { identifierHash: "hash:github_install_5", valueHash: "raw:state" },
      });
      expect(tx.githubInstallation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accountLogin: "acme",
            appId: 555,
            id: BigInt(88),
            repositorySelection: "ALL",
            targetId: BigInt(42),
            targetType: "ORGANIZATION",
            userId: 5,
          }),
        }),
      );
    });

    it("rejects an installation the user does not own", async () => {
      const { prisma } = makePrisma();
      prisma.verification.findFirst.mockResolvedValue({ id: "v1" });
      mocks.githubTokenService.getValidToken.mockResolvedValue("token");
      mocks.getPublicClient.mockReturnValue(makeOctokit([{ id: 99 }]));

      await expectForbidden(
        githubAppService.saveInstallation(prisma as never, 5, "88", "state"),
        /do not have permission/,
      );
      expect(mocks.appLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: "IDOR attempt: User tried to claim unowned installation",
        }),
      );
    });
  });
});
