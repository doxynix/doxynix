import { describe, expect, it } from "vitest";

import { ListApiKeysInputSchema } from "./api-key.schemas";

describe("ListApiKeysInputSchema", () => {
  it("defaults the page size the api-keys page and its prefetch share", () => {
    expect(ListApiKeysInputSchema.parse({})).toStrictEqual({ limit: 50 });
  });

  it("rejects a page size above the shared maximum", () => {
    expect(ListApiKeysInputSchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});
