import { describe, expect, it, vi } from "vitest";

import { githubService } from "@/server/services/github.service";

vi.mock("@octokit/rest", () => {
  class MockOctokit {
    static plugin() {
      return MockOctokit;
    }

    repos = {
      get: vi.fn().mockResolvedValue({ data: { id: 123, name: "test" } }),
      listForAuthenticatedUser: vi.fn().mockResolvedValue({ data: [] }),
    };

    rest = {
      repos: {
        listForAuthenticatedUser: vi.fn(),
      },
    };

    paginate = vi.fn().mockResolvedValue([]);

    log = {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    };

    constructor() {}
  }

  return {
    Octokit: MockOctokit,
  };
});

describe("GitHub Service", () => {
  describe("parseUrl", () => {
    it("should parse valid URLs", () => {
      expect(githubService.parseUrl("https://github.com/facebook/react")).toEqual({
        name: "react",
        owner: "facebook",
      });
      expect(githubService.parseUrl("facebook/react")).toEqual({
        name: "react",
        owner: "facebook",
      });
      expect(githubService.parseUrl("https://www.github.com/user/repo/")).toEqual({
        name: "repo",
        owner: "user",
      });
    });

    it("should throw on invalid URLs", () => {
      expect(() => githubService.parseUrl("just-string")).toThrow();
      expect(() => githubService.parseUrl("https://google.com")).toThrow();
      expect(() => githubService.parseUrl("/")).toThrow();
    });
  });

  describe("getClientContext", () => {
    it("should return octokit instance with token from DB", async () => {
      const mockPrisma = {
        account: {
          findFirst: vi.fn().mockResolvedValue({ access_token: "secret_token" }),
        },
      } as any;

      const { octokit } = await githubService.getClientContext(mockPrisma, 1);

      expect(octokit).toBeDefined();
      expect(octokit.repos).toBeDefined();
      expect(octokit.repos.get).toBeDefined();

      expect(mockPrisma.account.findFirst).toHaveBeenCalledWith({
        select: {
          access_token: true,
        },
        where: { provider: "github", userId: 1 },
      });
    });

    it("should fallback to env token if user has no token", async () => {
      const mockPrisma = {
        account: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      } as any;

      process.env.GITHUB_TOKEN = "env_token";

      const { octokit } = await githubService.getClientContext(mockPrisma, 1);
      expect(octokit).toBeDefined();
      expect(octokit.repos).toBeDefined();
    });
  });
});
