import { describe, expect, it, vi } from "vitest";

import { githubService } from "@/server/services/github.service";

vi.mock("@octokit/rest", () => {
  return {
    Octokit: class MockOctokit {
      repos = {
        get: vi.fn().mockResolvedValue({ data: { id: 123, name: "test" } }),
      };
    },
  };
});

describe("GitHub Service", () => {
  describe("parseUrl", () => {
    it("should parse valid URLs", () => {
      expect(githubService.parseUrl("https://github.com/facebook/react")).toEqual({
        owner: "facebook",
        name: "react",
      });
      expect(githubService.parseUrl("facebook/react")).toEqual({
        owner: "facebook",
        name: "react",
      });
      expect(githubService.parseUrl("https://www.github.com/user/repo/")).toEqual({
        owner: "user",
        name: "repo",
      });
    });

    it("should throw on invalid URLs", () => {
      expect(() => githubService.parseUrl("just-string")).toThrow();
      expect(() => githubService.parseUrl("https://google.com")).toThrow();
      expect(() => githubService.parseUrl("/")).toThrow();
    });
  });

  describe("getClientForUser", () => {
    it("should return octokit instance with token from DB", async () => {
      const mockPrisma = {
        account: {
          findFirst: vi.fn().mockResolvedValue({ access_token: "secret_token" }),
        },
      } as any;

      const client = await githubService.getClientForUser(mockPrisma, 1);

      expect(client).toBeDefined();
      expect(client.repos).toBeDefined();
      expect(client.repos.get).toBeDefined();

      expect(mockPrisma.account.findFirst).toHaveBeenCalledWith({
        where: { userId: 1, provider: "github" },
      });
    });

    it("should fallback to env token if user has no token", async () => {
      const mockPrisma = {
        account: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      } as any;

      process.env.GITHUB_TOKEN = "env_token";

      const client = await githubService.getClientForUser(mockPrisma, 1);
      expect(client).toBeDefined();
      expect(client.repos).toBeDefined();
    });
  });
});
