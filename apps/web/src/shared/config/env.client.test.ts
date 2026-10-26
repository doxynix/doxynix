import { describe, expect, it } from "vitest";

import { TRPC_PREFIX } from "./env.client";

// Scalar resolves each documented path against `baseServerURL`; without the `/api/trpc`
// segment every "Try it" button requested `https://host/<procedure>` and 404'd.
describe("TRPC_REST_MOUNT_PATH", () => {
  it("matches the on-disk route that serves the REST surface", () => {
    expect(TRPC_PREFIX).toBe("/api/trpc");
  });

  it("is an absolute path with no trailing slash, so joins stay well-formed", () => {
    expect(TRPC_PREFIX.startsWith("/")).toBe(true);
    expect(TRPC_PREFIX.endsWith("/")).toBe(false);
  });

  it("still forms a valid URL when joined with a documented procedure", () => {
    const url = new URL(`https://doxynix.space${TRPC_PREFIX}/analysis.getComments`);

    expect(url.pathname).toBe("/api/trpc/analysis.getComments");
  });
});
