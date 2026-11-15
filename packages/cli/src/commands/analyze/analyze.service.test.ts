import { afterEach, describe, expect, it, vi } from "vitest";

const { historyQuery } = vi.hoisted(() => ({ historyQuery: vi.fn() }));

vi.mock("@/core/client", () => ({
  trpc: { analysis: { getHistory: { query: historyQuery } } },
}));

import { analyzeService } from "./analyze.service";

type Run = { id: string; status: string };

function page(items: Run[], nextCursor?: string, total: null | number = items.length) {
  return {
    items,
    meta: { hasNextPage: nextCursor != null, nextCursor },
    total,
  };
}

function runs(from: number, count: number, status: string): Run[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `run-${from + index}`,
    status,
  }));
}

describe("analyze service", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("walks every page so an in-flight run older than the first page stays reachable", async () => {
    historyQuery
      .mockResolvedValueOnce(page(runs(100, 100, "DONE"), "cursor-2", 120))
      .mockResolvedValueOnce(page(runs(200, 20, "PENDING"), undefined, null));

    const history = await analyzeService.getHistory("repo-1");

    expect(historyQuery).toHaveBeenCalledTimes(2);
    expect(historyQuery).toHaveBeenNthCalledWith(1, {
      cursor: undefined,
      limit: 100,
      repoId: "repo-1",
    });
    expect(historyQuery).toHaveBeenNthCalledWith(2, {
      cursor: "cursor-2",
      limit: 100,
      repoId: "repo-1",
    });
    expect(history.items).toHaveLength(120);
    expect(history.items.filter((run) => run.status === "PENDING")).toHaveLength(20);
    expect(history.meta.hasNextPage).toBe(false);
    expect(history.total).toBe(120);
  });

  it("reports the truncation when the page bound stops the walk", async () => {
    historyQuery.mockResolvedValue(page(runs(100, 100, "DONE"), "cursor-next", 5000));

    const history = await analyzeService.getHistory("repo-1");

    expect(historyQuery).toHaveBeenCalledTimes(10);
    expect(history.items).toHaveLength(1000);
    expect(history.meta.hasNextPage).toBe(true);
    expect(history.total).toBe(5000);
  });
});
