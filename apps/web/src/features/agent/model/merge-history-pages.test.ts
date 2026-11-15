import { describe, expect, it } from "vitest";

import { mergeOlderHistory } from "./merge-history-pages";

function page(...ids: string[]) {
  return { items: ids.map((id) => ({ id })) };
}

function ids(result: { items: { id: string }[] }) {
  return result.items.map((item) => item.id);
}

const newestPage = page("n1", "n2");
const olderPage = page("o1", "o2");
const oldestPage = page("a1", "a2");

describe("mergeOlderHistory", () => {
  it("returns nothing when the loaded pages are all the pages", () => {
    expect(mergeOlderHistory([newestPage], 1)).toStrictEqual({ addedCount: 0, items: [] });
  });

  it("returns one older page in its own order", () => {
    expect(ids(mergeOlderHistory([newestPage, olderPage], 1))).toStrictEqual(["o1", "o2"]);
  });

  it("puts the oldest page first when two older pages arrive together", () => {
    expect(ids(mergeOlderHistory([newestPage, olderPage, oldestPage], 1))).toStrictEqual([
      "a1",
      "a2",
      "o1",
      "o2",
    ]);
  });

  it("counts the prepended items so the caller can shift the first item index", () => {
    const result = mergeOlderHistory([newestPage, olderPage, oldestPage], 1);

    expect(result.addedCount).toBe(result.items.length);
    expect(result.addedCount).toBe(4);
  });

  it("only reports pages added since the last merge", () => {
    expect(ids(mergeOlderHistory([newestPage, olderPage, oldestPage], 2))).toStrictEqual([
      "a1",
      "a2",
    ]);
  });
});
