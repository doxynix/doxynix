import { describe, expect, it, vi } from "vitest";

import { collectCursorPages } from "./cursor-pages";

function pagedSource(pages: string[][]) {
  return vi.fn((cursor: string | undefined) => {
    const index = cursor == null ? 0 : Number(cursor.replace("cursor-", ""));

    return Promise.resolve({
      items: pages[index] ?? [],
      meta: {
        hasNextPage: index + 1 < pages.length,
        nextCursor: index + 1 < pages.length ? `cursor-${index + 1}` : undefined,
      },
    });
  });
}

describe("shared/utils:collectCursorPages", () => {
  it("walks the cursor until the server stops returning one", async () => {
    const fetchPage = pagedSource([["a", "b"], ["c"]]);

    await expect(collectCursorPages(fetchPage)).resolves.toStrictEqual(["a", "b", "c"]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage).toHaveBeenLastCalledWith("cursor-1");
  });

  it("stops at the page bound when the server keeps handing out cursors", async () => {
    const fetchPage = vi.fn(() =>
      Promise.resolve({ items: ["x"], meta: { hasNextPage: true, nextCursor: "cursor-1" } }),
    );

    await expect(collectCursorPages(fetchPage, 3)).resolves.toStrictEqual(["x", "x", "x"]);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it("returns nothing for an empty first page", async () => {
    await expect(collectCursorPages(pagedSource([[]]))).resolves.toStrictEqual([]);
  });
});
