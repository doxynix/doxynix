import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/server/core/trpc/server", () => ({ api: mocks.api }));

import { repoFetchers } from "./repo.fetchers";

const UUID = "7f9c0c52-6f0d-4f6b-9c5e-3d4e5f6a7b8c";
const repoFixture = { id: UUID, name: "repo", owner: "acme" };

describe("repoFetchers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
  });

  describe("getOwnerOrNotFound", () => {
    it("returns the repo when found", async () => {
      const getByOwner = vi.fn().mockResolvedValue(repoFixture);
      mocks.api.mockResolvedValue({ repo: { getByOwner } });

      await expect(repoFetchers.getOwnerOrNotFound("acme")).resolves.toEqual(repoFixture);
      expect(getByOwner).toHaveBeenCalledWith({ owner: "acme" });
    });

    it("calls notFound when the repo is null", async () => {
      const getByOwner = vi.fn().mockResolvedValue(null);
      mocks.api.mockResolvedValue({ repo: { getByOwner } });

      await expect(repoFetchers.getOwnerOrNotFound("acme")).rejects.toThrow("NEXT_NOT_FOUND");
      expect(getByOwner).toHaveBeenCalledWith({ owner: "acme" });
      expect(mocks.notFound).toHaveBeenCalled();
    });
  });

  describe("getRepoOrNotFound", () => {
    it("returns the repo when found", async () => {
      const getByName = vi.fn().mockResolvedValue(repoFixture);
      mocks.api.mockResolvedValue({ repo: { getByName } });

      await expect(repoFetchers.getRepoOrNotFound("acme", "repo")).resolves.toEqual(repoFixture);
      expect(getByName).toHaveBeenCalledWith({ name: "repo", owner: "acme" });
    });

    it("calls notFound when the repo is null", async () => {
      const getByName = vi.fn().mockResolvedValue(null);
      mocks.api.mockResolvedValue({ repo: { getByName } });

      await expect(repoFetchers.getRepoOrNotFound("acme", "repo")).rejects.toThrow(
        "NEXT_NOT_FOUND",
      );
      expect(mocks.notFound).toHaveBeenCalled();
    });
  });
});
