import { MAX_PAGE_SIZE } from "@doxynix/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries the repository fix list using the repo id", async () => {
    query.mockResolvedValue({ items: [{ id: "fix-1" }], meta: { hasNextPage: false } });

    await expect(fetchFixes("repo-1")).resolves.toEqual([{ id: "fix-1" }]);
    expect(query).toHaveBeenCalledWith({
      cursor: undefined,
      limit: MAX_PAGE_SIZE,
      repoId: "repo-1",
    });
  });

  it("walks every page so the fix list stays complete", async () => {
    query.mockImplementation(async ({ cursor }) =>
      cursor == null
        ? { items: [{ id: "fix-1" }], meta: { hasNextPage: true, nextCursor: "cursor-1" } }
        : { items: [{ id: "fix-2" }], meta: { hasNextPage: false } },
    );

    await expect(fetchFixes("repo-1")).resolves.toEqual([{ id: "fix-1" }, { id: "fix-2" }]);
    expect(query).toHaveBeenCalledTimes(2);
  });
});
