import { afterEach, describe, expect, it } from "vitest";

import { getSpecByExt } from "./index";
import { compileQuery, disposeQueries } from "./query-cache";

const TS_QUERY = `
  (function_declaration name: (identifier) @fn.name) @fn
`;

describe("compileQuery", () => {
  afterEach(() => {
    disposeQueries();
  });

  it("caches one query object per extension and source", async () => {
    const spec = getSpecByExt(".ts");
    expect(spec).toBeDefined();
    if (spec == null) {
      throw new Error("missing grammar spec");
    }

    const first = await compileQuery(".ts", spec, TS_QUERY);
    const second = await compileQuery(".ts", spec, TS_QUERY);

    expect(first).toBe(second);
  });

  it("rejects an invalid query instead of caching it", async () => {
    const spec = getSpecByExt(".ts");
    expect(spec).toBeDefined();
    if (spec == null) {
      throw new Error("missing grammar spec");
    }

    await expect(compileQuery(".ts", spec, "(not_a_real_node) @x")).rejects.toThrow(
      /not_a_real_node/,
    );
    await expect(compileQuery(".ts", spec, "(not_a_real_node) @x")).rejects.toThrow(
      /not_a_real_node/,
    );
  });
});
