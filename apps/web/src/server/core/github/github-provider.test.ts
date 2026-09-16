import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";

// ── Hoisted mocks: defined before vi.mock calls ──────────────────────────────
const mocks = vi.hoisted(() => {
  return {
    AppOctokitClass: class {
      rest = {};
      paginate = vi.fn();
      constructor(config?: unknown) {
        Object.assign(this, { config });
      }
    },
    appLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
    tokenService: { getValidToken: vi.fn() },
  };
});

// ── Module mocks ─────────────────────────────────────────────────────────────
vi.mock("@octokit/rest", () => ({
  Octokit: {
    plugin: vi.fn(() => mocks.AppOctokitClass),
  },
}));
vi.mock("@octokit/auth-app", () => ({
  createAppAuth: vi.fn(() => "auth-strategy"),
}));
vi.mock("@octokit/plugin-paginate-rest", () => ({ paginateRest: "paginateRest" }));
vi.mock("@octokit/plugin-retry", () => ({ retry: "retry" }));
vi.mock("@octokit/plugin-throttling", () => ({ throttling: "throttling" }));
vi.mock("octokit-plugin-create-pull-request", () => ({
  createPullRequest: "createPullRequest",
}));
vi.mock("@/shared/config/env.server", () => ({
  APP_VERSION: "1.0.0-test",
  GITHUB_APP_ID: "12345",
  GITHUB_APP_PRIVATE_KEY: "private-key",
  GITHUB_SYSTEM_INSTALLATION_ID: "77",
  GITHUB_SYSTEM_PAT: "pat-123",
}));
vi.mock("../app-logger", () => ({ appLogger: mocks.appLogger }));
vi.mock("../db", () => ({ prisma: {}, redisClient: null }));
vi.mock("./git-url", () => ({
  parseGitUrl: vi.fn((input: string) => {
    const trimmed = input.trim();
    const m = /^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/.exec(trimmed);
    if (m) {
      const rawOwner = m[1];
      const rawName = m[2];
      if (rawOwner == null || rawName == null) {
        throw new Error("Invalid Git URL format");
      }
      const name = rawName.endsWith(".git") ? rawName.slice(0, -4) : rawName;
      return {
        full_name: `${rawOwner}/${name}`,
        href: `https://github.com/${rawOwner}/${name}.git`,
        name,
        owner: rawOwner,
        port: null,
        protocol: "https",
        resource: "github.com",
      };
    }
    const u = /^https?:\/\/([^/]+)\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(trimmed);
    if (u) {
      const [, host, owner, repo] = u;
      return {
        full_name: `${owner}/${repo}`,
        href: trimmed,
        name: repo,
        owner,
        port: null,
        protocol: "https",
        resource: host,
      };
    }
    throw new Error("Invalid Git URL format");
  }),
}));
vi.mock("./github-token.service", () => ({ githubTokenService: mocks.tokenService }));

// ── Imports under test (after mocks) ─────────────────────────────────────────
import {
  GitHubAuthRequiredError,
  getClientContext,
  getInstallationClient,
  getPublicClient,
  parseUrl,
  resolveClientContext,
} from "./github-provider";

// ── Fixtures ─────────────────────────────────────────────────────────────────
function makePrismaMock() {
  const findFirst = vi.fn();
  return {
    githubInstallation: { findFirst },
  } as unknown as DbClient;
}

// ── Reset between tests ──────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mocks.tokenService.getValidToken.mockResolvedValue(null);
});

// ============================================================================
// parseUrl
// ============================================================================
describe("parseUrl", () => {
  it("parses owner/repo shorthand", () => {
    expect(parseUrl("owner/repo")).toEqual({ name: "repo", owner: "owner" });
  });

  it("parses a full GitHub URL", () => {
    expect(parseUrl("https://github.com/owner/repo.git")).toEqual({
      name: "repo",
      owner: "owner",
    });
  });

  it("throws on empty string", () => {
    expect(() => parseUrl("")).toThrow("Field cannot be empty");
  });

  it("throws on invalid format", () => {
    expect(() => parseUrl("not a url")).toThrow(
      /Invalid format\. Enter 'owner\/repo' or repository URL/,
    );
  });
});

// ============================================================================
// GitHubAuthRequiredError
// ============================================================================
describe("GitHubAuthRequiredError", () => {
  it("is an instance of Error with correct name and message", () => {
    const error = new GitHubAuthRequiredError();
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(GitHubAuthRequiredError);
    expect(error.name).toBe("GitHubAuthRequiredError");
    expect(error.message).toMatch(/No valid GitHub authorization/);
  });
});

// ============================================================================
// getInstallationClient / getPublicClient (factory sanity)
// ============================================================================
describe("client factories", () => {
  it("getInstallationClient returns an instance of the stubbed class", () => {
    const client = getInstallationClient(9);
    expect(client).toBeInstanceOf(mocks.AppOctokitClass);
    expect(client.rest).toBeDefined();
  });

  it("getPublicClient with token returns an instance", () => {
    const client = getPublicClient("abc");
    expect(client).toBeInstanceOf(mocks.AppOctokitClass);
  });

  it("getPublicClient without token returns an instance", () => {
    const client = getPublicClient();
    expect(client).toBeInstanceOf(mocks.AppOctokitClass);
  });
});

// ============================================================================
// getClientContext
// ============================================================================
describe("getClientContext", () => {
  it("returns specific installation when owner matches", async () => {
    const prisma = makePrismaMock();
    (prisma.githubInstallation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 9n,
    });

    const ctx = await getClientContext(prisma, 1, "owner");

    expect(ctx).toMatchObject({
      githubInstallationId: 9,
      hasUserToken: false,
      type: "installation",
    });
    expect(ctx.octokit).toBeInstanceOf(mocks.AppOctokitClass);
  });

  it("returns oauth context when token is available", async () => {
    const prisma = makePrismaMock();
    (prisma.githubInstallation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    mocks.tokenService.getValidToken.mockResolvedValue("token-x");

    const ctx = await getClientContext(prisma, 1, "owner");

    expect(ctx.type).toBe("oauth");
    expect(ctx.hasUserToken).toBe(true);
    expect(ctx.octokit).toBeInstanceOf(mocks.AppOctokitClass);
  });

  it("returns any installation when owner is undefined", async () => {
    const prisma = makePrismaMock();
    (prisma.githubInstallation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 5n,
    });

    const ctx = await getClientContext(prisma, 1);

    expect(ctx).toMatchObject({ githubInstallationId: 5, type: "installation" });
    expect(ctx.hasUserToken).toBe(false);
  });

  it("throws GitHubAuthRequiredError when nothing is available", async () => {
    const prisma = makePrismaMock();
    (prisma.githubInstallation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(getClientContext(prisma, 1)).rejects.toThrow(GitHubAuthRequiredError);
  });
});

// ============================================================================
// resolveClientContext
// ============================================================================
describe("resolveClientContext", () => {
  it("returns primary context when getClientContext succeeds", async () => {
    const prisma = makePrismaMock();
    mocks.tokenService.getValidToken.mockResolvedValue("token-y");

    const ctx = await resolveClientContext(prisma, 1);

    expect(ctx.type).toBe("oauth");
    expect(ctx.hasUserToken).toBe(true);
  });

  it("falls back to public when allowPublicFallback is true", async () => {
    const prisma = makePrismaMock();
    (prisma.githubInstallation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const ctx = await resolveClientContext(prisma, 1, { allowPublicFallback: true });

    expect(ctx.type).toBe("public");
    expect(ctx.hasUserToken).toBe(false);
    expect(ctx.octokit).toBeInstanceOf(mocks.AppOctokitClass);
  });

  it("falls back to app when allowSystemFallback is true", async () => {
    const prisma = makePrismaMock();
    (prisma.githubInstallation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const ctx = await resolveClientContext(prisma, 1, { allowSystemFallback: true });

    expect(ctx.type).toBe("app");
    expect(ctx.hasUserToken).toBe(false);
    expect(ctx.octokit).toBeInstanceOf(mocks.AppOctokitClass);
  });

  it("rethrows GitHubAuthRequiredError when no fallback is allowed", async () => {
    const prisma = makePrismaMock();
    (prisma.githubInstallation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(resolveClientContext(prisma, 1)).rejects.toThrow(GitHubAuthRequiredError);
  });
});

// ============================================================================
// getInstallationInfo — skipped (requires heavier octokit.rest stubbing)
// ============================================================================
// TODO: add tests for getInstallationInfo when octokit.rest.apps.getInstallation
// stub is set up.
