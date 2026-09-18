import type { Repo } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGit = {
  clone: vi.fn().mockResolvedValue(undefined),
  cwd: vi.fn().mockResolvedValue(undefined),
};

vi.mock("node:fs/promises", () => ({
  default: { mkdir: vi.fn(), rm: vi.fn() },
}));

vi.mock("simple-git", () => ({ default: () => mockGit }));

vi.mock("@/server/modules/analysis/logic/task-logger", () => ({
  taskLogger: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

vi.mock("./git-url", () => ({
  parseGitUrl: () => ({ full_name: "doxynix/app", resource: "github.com" }),
}));

import { cloneRepository, shouldUseCache } from "./git";

describe("git utilities — Security & Performance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. cloneRepository security token masking", () => {
    const repo = {
      defaultBranch: "main",
      name: "app",
      owner: "doxynix",
      url: "https://github.com",
    } as Repo;

    it("masks secret tokens in error outputs to prevent credential leak in logs", async () => {
      const secretToken = "ghp_super_secret_token_12345";

      mockGit.clone.mockRejectedValueOnce(
        new Error(`fatal: Auth failed for https://x-access-token:${secretToken}@github.com`),
      );

      await expect(cloneRepository(repo, secretToken, "/tmp/dir")).rejects.toThrow(
        "Failed to clone repository: fatal: Auth failed for https://x-access-token:***@github.com",
      );
    });

    it("injects base64 basic auth header into git clone options when token is present", async () => {
      const token = "ghp_token123";
      const expectedAuth = Buffer.from(`x-access-token:${token}`).toString("base64");

      await cloneRepository(repo, token, "/tmp/dir");

      expect(mockGit.clone).toHaveBeenCalledWith(
        "https://github.com/doxynix/app.git",
        "/tmp/dir",
        expect.arrayContaining(["-c", `http.extraheader=Authorization: Basic ${expectedAuth}`]),
      );
    });
  });

  describe("2. shouldUseCache (Analysis caching matrix)", () => {
    it("returns true when SHAs match and forceRefresh is not true", () => {
      const result = shouldUseCache({
        currentSha: "sha-123",
        forceRefresh: false,
        lastSuccessfulSha: "sha-123",
      });

      expect(result).toBe(true);
    });

    it("returns false when SHAs match but forceRefresh is explicitly enabled", () => {
      const result = shouldUseCache({
        currentSha: "sha-123",
        forceRefresh: true,
        lastSuccessfulSha: "sha-123",
      });

      expect(result).toBe(false);
    });

    it("returns false when SHAs are completely different", () => {
      const result = shouldUseCache({
        currentSha: "sha-new",
        forceRefresh: false,
        lastSuccessfulSha: "sha-old",
      });

      expect(result).toBe(false);
    });
  });
});
