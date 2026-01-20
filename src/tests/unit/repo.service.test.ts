import { Status, Visibility } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { githubService } from "@/server/services/github.service";
import { repoService } from "@/server/services/repo.service";

vi.mock("@/server/services/github.service", () => ({
  githubService: {
    parseUrl: vi.fn(),
    getRepoInfo: vi.fn(),
  },
}));

vi.mock("@/server/utils/handlePrismaError", () => ({
  handlePrismaError: vi.fn((e) => {
    throw e;
  }),
}));

describe("Repo Service", () => {
  const mockDb = {
    repo: {
      create: vi.fn(),
    },
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createRepo", () => {
    it("should successfully create a repo", async () => {
      vi.mocked(githubService.parseUrl).mockReturnValue({ owner: "test", name: "repo" });
      vi.mocked(githubService.getRepoInfo).mockResolvedValue({
        id: 100,
        owner: { login: "test", avatar_url: "avatar.jpg" },
        name: "repo",
        description: "desc",
        html_url: "http://github.com/test/repo",
        stargazers_count: 10,
        private: false,
        created_at: "2023-01-01",
        pushed_at: "2023-01-02",
      } as any);

      mockDb.repo.create.mockResolvedValue({ id: 1, name: "repo" });

      const result = await repoService.createRepo(mockDb, 1, "test/repo");

      expect(result).toEqual({ id: 1, name: "repo" });
      expect(mockDb.repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            githubId: 100,
            visibility: "PUBLIC",
            userId: 1,
          }),
        })
      );
    });

    it("should throw BAD_REQUEST on invalid URL", async () => {
      vi.mocked(githubService.parseUrl).mockImplementation(() => {
        throw new Error();
      });

      await expect(repoService.createRepo(mockDb, 1, "bad-url")).rejects.toThrow(TRPCError);
    });

    it("should handle GitHub 404 error", async () => {
      vi.mocked(githubService.parseUrl).mockReturnValue({ owner: "a", name: "b" });
      vi.mocked(githubService.getRepoInfo).mockRejectedValue({ status: 404 });

      await expect(repoService.createRepo(mockDb, 1, "a/b")).rejects.toThrow(
        "Repository not found"
      );
    });
  });

  describe("buildWhereClause", () => {
    it("should return empty object if no filters", () => {
      const res = repoService.buildWhereClause({});
      expect(res).toEqual({});
    });

    it("should filter by visibility", () => {
      const res = repoService.buildWhereClause({ visibility: Visibility.PRIVATE });
      expect(res).toEqual({ visibility: Visibility.PRIVATE });
    });

    it("should filter by search term", () => {
      const res = repoService.buildWhereClause({ search: "react" });
      expect(res).toHaveProperty("AND");
      expect(JSON.stringify(res)).toContain("react");
      expect(JSON.stringify(res)).toContain("insensitive");
    });

    it("should filter by NEW status logic", () => {
      const res = repoService.buildWhereClause({ status: Status.NEW });
      expect(res).toHaveProperty("OR");
    });
  });
});
