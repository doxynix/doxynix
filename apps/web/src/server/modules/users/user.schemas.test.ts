import { describe, expect, it } from "vitest";

import { ActiveSessionsInputSchema } from "./user.schemas";

describe("ActiveSessionsInputSchema", () => {
  it("defaults the page size the sessions page and its prefetch share", () => {
    expect(ActiveSessionsInputSchema.parse({})).toStrictEqual({ limit: 50 });
  });

  it("accepts a keyset cursor", () => {
    const cursor = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";

    expect(ActiveSessionsInputSchema.parse({ cursor, limit: 20 })).toStrictEqual({
      cursor,
      limit: 20,
    });
  });
});
