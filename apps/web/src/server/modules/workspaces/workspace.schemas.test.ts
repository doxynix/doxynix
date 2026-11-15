import { CursorMetaSchema } from "@doxynix/shared";
import { describe, expect, it } from "vitest";

import { WorkspaceMembersInputSchema, WorkspaceMembersOutputSchema } from "./workspace.schemas";

const MEMBER_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
const USER_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e";

describe("workspace members schemas", () => {
  it("pages fifty members when the caller sends no limit", () => {
    expect(WorkspaceMembersInputSchema.parse({}).limit).toBe(50);
    expect(WorkspaceMembersInputSchema.parse({ cursor: null }).limit).toBe(50);
  });

  it("keysets on the member id and rejects a non-uuid cursor", () => {
    expect(WorkspaceMembersInputSchema.parse({ cursor: MEMBER_ID, limit: 10 })).toStrictEqual({
      cursor: MEMBER_ID,
      limit: 10,
    });
    expect(WorkspaceMembersInputSchema.safeParse({ cursor: "page-2" }).success).toBe(false);
  });

  it("declares the counts the page reads instead of recomputing them", () => {
    const response = {
      items: [
        {
          id: MEMBER_ID,
          role: "OWNER",
          user: { id: USER_ID, image: null, name: "Alice" },
          userId: USER_ID,
        },
      ],
      meta: { hasNextPage: true, nextCursor: MEMBER_ID },
      ownerCount: 1,
      total: 2,
    };

    expect(WorkspaceMembersOutputSchema.parse(response)).toStrictEqual(response);
    expect(WorkspaceMembersOutputSchema.shape.meta).toBe(CursorMetaSchema);
    expect(
      WorkspaceMembersOutputSchema.safeParse({ ...response, ownerCount: undefined }).success,
    ).toBe(false);
  });
});
