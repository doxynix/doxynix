import { describe, expect, it, vi } from "vitest";

const query = vi.hoisted(() => vi.fn());

vi.mock("./client", () => ({
  trpc: {
    analysis: {
      getByRepository: { query },
    },
  },
}));

import { fetchFixes } from "./fixes";

describe("fetchFixes", () => {
  it("queries the repository fix list using the repo id", async () => {
    query.mockResolvedValue([{ id: "fix-1" }]);

    await expect(fetchFixes("repo-1")).resolves.toEqual([{ id: "fix-1" }]);
    expect(query).toHaveBeenCalledWith({ repoId: "repo-1" });
  });
});
