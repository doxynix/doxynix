import { Status, Visibility } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { githubService } from "@/server/services/github.service";
import { repoService } from "@/server/services/repo.service";

vi.mock("@/server/services/github.service", () => ({
  githubService: {
    getRepoInfo: vi.fn(),
    parseUrl: vi.fn(),
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
      vi.mocked(githubService.parseUrl).mockReturnValue({ name: "repo", owner: "test" });
      vi.mocked(githubService.getRepoInfo).mockResolvedValue({
        created_at: "2023-01-01",
        description: "desc",
        html_url: "https://github.com/test/repo",
        id: 100,
        name: "repo",
        owner: { avatar_url: "avatar.jpg", login: "test" },
        private: false,
        pushed_at: "2023-01-02",
        stargazers_count: 10,
      } as any);

      mockDb.repo.create.mockResolvedValue({ id: 1, name: "repo" });

      const result = await repoService.createRepo(mockDb, 1, "test/repo");

      expect(result).toEqual({ id: 1, name: "repo" });
      expect(mockDb.repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            githubId: 100,
            userId: 1,
            visibility: "PUBLIC",
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
      vi.mocked(githubService.parseUrl).mockReturnValue({ name: "b", owner: "a" });
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
