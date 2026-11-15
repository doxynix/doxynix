import { describe, expect, it } from "vitest";

import { clampPaginationMax, getPaginationItems, isBeyondMaxPage } from "./pagination";

const pages = (totalPages: number, currentPage: number) =>
  getPaginationItems(totalPages, currentPage);

describe("getPaginationItems", () => {
  it("renders every page when totalPages is 7", () => {
    expect(pages(7, 1)).toEqual([
      { key: 1, kind: "page", page: 1 },
      { key: 2, kind: "page", page: 2 },
      { key: 3, kind: "page", page: 3 },
      { key: 4, kind: "page", page: 4 },
      { key: 5, kind: "page", page: 5 },
      { key: 6, kind: "page", page: 6 },
      { key: 7, kind: "page", page: 7 },
    ]);
  });

  it("renders every page when totalPages is below 7", () => {
    expect(pages(5, 3)).toEqual([
      { key: 1, kind: "page", page: 1 },
      { key: 2, kind: "page", page: 2 },
      { key: 3, kind: "page", page: 3 },
      { key: 4, kind: "page", page: 4 },
      { key: 5, kind: "page", page: 5 },
    ]);
  });

  it("collapses far pages at the very first page", () => {
    expect(pages(8, 1)).toEqual([
      { key: 1, kind: "page", page: 1 },
      { key: 2, kind: "page", page: 2 },
      { key: 3, kind: "ellipsis" },
      { key: 8, kind: "page", page: 8 },
    ]);
  });

  it("collapses far pages at the very last page", () => {
    expect(pages(20, 20)).toEqual([
      { key: 1, kind: "page", page: 1 },
      { key: 18, kind: "ellipsis" },
      { key: 19, kind: "page", page: 19 },
      { key: 20, kind: "page", page: 20 },
    ]);
  });

  it("collapses far pages near the last page", () => {
    expect(pages(20, 19)).toEqual([
      { key: 1, kind: "page", page: 1 },
      { key: 17, kind: "ellipsis" },
      { key: 18, kind: "page", page: 18 },
      { key: 19, kind: "page", page: 19 },
      { key: 20, kind: "page", page: 20 },
    ]);
  });

  it("keeps the second page visible when current is the first", () => {
    expect(pages(20, 1)).toEqual([
      { key: 1, kind: "page", page: 1 },
      { key: 2, kind: "page", page: 2 },
      { key: 3, kind: "ellipsis" },
      { key: 20, kind: "page", page: 20 },
    ]);
  });

  it("puts a single ellipsis on the right when current is the second page", () => {
    expect(pages(20, 2)).toEqual([
      { key: 1, kind: "page", page: 1 },
      { key: 2, kind: "page", page: 2 },
      { key: 3, kind: "page", page: 3 },
      { key: 4, kind: "ellipsis" },
      { key: 20, kind: "page", page: 20 },
    ]);
  });

  it("puts ellipsis on both sides in the middle", () => {
    expect(pages(20, 10)).toEqual([
      { key: 1, kind: "page", page: 1 },
      { key: 8, kind: "ellipsis" },
      { key: 9, kind: "page", page: 9 },
      { key: 10, kind: "page", page: 10 },
      { key: 11, kind: "page", page: 11 },
      { key: 12, kind: "ellipsis" },
      { key: 20, kind: "page", page: 20 },
    ]);
  });

  it("handles a single page", () => {
    expect(pages(1, 1)).toEqual([{ key: 1, kind: "page", page: 1 }]);
  });

  it("yields no items for an empty pagination", () => {
    expect(pages(0, 1)).toEqual([]);
  });
});

describe("clampPaginationMax", () => {
  it("keeps a reachable page count as it is", () => {
    expect(clampPaginationMax(1)).toBe(1);
    expect(clampPaginationMax(100)).toBe(100);
  });

  it("clamps a count past the offset ceiling the server enforces", () => {
    expect(clampPaginationMax(101)).toBe(100);
    expect(clampPaginationMax(6200)).toBe(100);
  });
});

describe("isBeyondMaxPage", () => {
  it("flags only the counts the server would clamp", () => {
    expect(isBeyondMaxPage(100)).toBe(false);
    expect(isBeyondMaxPage(101)).toBe(true);
  });
});
