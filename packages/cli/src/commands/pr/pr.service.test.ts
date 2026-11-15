import { afterEach, describe, expect, it, vi } from "vitest";

const { listQuery } = vi.hoisted(() => ({ listQuery: vi.fn() }));

vi.mock("@/core/client", () => ({
  trpc: { analysis: { listByRepository: { query: listQuery } } },
}));

import { prService } from "./pr.service";

type Pull = { id: string; prNumber: number };

function page(items: Pull[], nextCursor?: string, total: null | number = items.length) {
  return {
    items,
    meta: { hasNextPage: nextCursor != null, nextCursor },
    total,
  };
}

function pulls(from: number, count: number): Pull[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `analysis-${from + index}`,
    prNumber: from + index,
  }));
}

describe("pr service", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("resolves a PR that only exists past the first page", async () => {
    listQuery
      .mockResolvedValueOnce(page(pulls(100, 100), "cursor-2", 120))
      .mockResolvedValueOnce(page(pulls(200, 20), undefined, null));

    const result = await prService.listByRepository("repo-1");

    expect(listQuery).toHaveBeenCalledTimes(2);
    expect(listQuery).toHaveBeenNthCalledWith(1, {
      cursor: undefined,
      limit: 100,
      repoId: "repo-1",
    });
    expect(listQuery).toHaveBeenNthCalledWith(2, {
      cursor: "cursor-2",
      limit: 100,
      repoId: "repo-1",
    });
    expect(result.items).toHaveLength(120);
    expect(result.items.find((item) => item.prNumber === 205)).toEqual({
      id: "analysis-205",
      prNumber: 205,
    });
    expect(result.meta.hasNextPage).toBe(false);
    expect(result.total).toBe(120);
  });

  it("reports the truncation when the page bound stops the walk", async () => {
    listQuery.mockResolvedValue(page(pulls(100, 100), "cursor-next", 5000));

    const result = await prService.listByRepository("repo-1");

    expect(listQuery).toHaveBeenCalledTimes(10);
    expect(result.items).toHaveLength(1000);
    // The footer must say "showing 1000 of 5000" instead of claiming a complete list.
    expect(result.meta.hasNextPage).toBe(true);
    expect(result.total).toBe(5000);
  });
});
