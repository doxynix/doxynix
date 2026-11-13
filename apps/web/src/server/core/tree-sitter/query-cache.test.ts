import { afterEach, describe, expect, it, vi } from "vitest";
import type * as WebTreeSitter from "web-tree-sitter";

const queryConstruction = vi.hoisted(() => ({ count: 0 }));

vi.mock("web-tree-sitter", async (importOriginal) => {
  const actual = await importOriginal<typeof WebTreeSitter>();

  class CountingQuery extends actual.Query {
    constructor(language: InstanceType<typeof actual.Language>, source: string) {
      queryConstruction.count += 1;
      super(language, source);
    }
  }

  return { ...actual, Query: CountingQuery };
});

import { getSpecByExt } from "./index";
import { compileQuery, disposeQueries } from "./query-cache";

const TS_QUERY = `
  (function_declaration name: (identifier) @fn.name) @fn
`;
const INVALID_QUERY = "(not_a_real_node) @x";

function tsSpec() {
  const spec = getSpecByExt(".ts");
  expect(spec).toBeDefined();
  if (spec == null) {
    throw new Error("missing grammar spec");
  }
  return spec;
}

describe("compileQuery", () => {
  afterEach(() => {
    disposeQueries();
    queryConstruction.count = 0;
    vi.restoreAllMocks();
  });

  it("caches one query object per extension and source", async () => {
    const first = await compileQuery(".ts", tsSpec(), TS_QUERY);
    const second = await compileQuery(".ts", tsSpec(), TS_QUERY);

    expect(first).toBe(second);
    expect(queryConstruction.count).toBe(1);
  });

  it("rejects an invalid query instead of caching it", async () => {
    await expect(compileQuery(".ts", tsSpec(), INVALID_QUERY)).rejects.toThrow(/not_a_real_node/);
    await expect(compileQuery(".ts", tsSpec(), INVALID_QUERY)).rejects.toThrow(/not_a_real_node/);
  });

  it("evicts a rejected query so the next compile asks the grammar again", async () => {
    await expect(compileQuery(".ts", tsSpec(), INVALID_QUERY)).rejects.toThrow(/not_a_real_node/);
    await expect(compileQuery(".ts", tsSpec(), INVALID_QUERY)).rejects.toThrow(/not_a_real_node/);

    expect(queryConstruction.count).toBe(2);
  });

  it("handles out a fresh query after the cache is cleared", async () => {
    const first = await compileQuery(".ts", tsSpec(), TS_QUERY);

    disposeQueries();

    const again = await compileQuery(".ts", tsSpec(), TS_QUERY);
    expect(again).not.toBe(first);
  });

  it("deletes the cached query handles when the cache is cleared", async () => {
    const query = await compileQuery(".ts", tsSpec(), TS_QUERY);
    const deleteSpy = vi.spyOn(query, "delete");

    disposeQueries();

    await vi.waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledTimes(1);
    });
  });
});
