import { describe, expect, it } from "vitest";

import { flattenSessionPages } from "./session-pages";

function page(...ids: string[]) {
  return { items: ids.map((id) => ({ id })) };
}

function ids(sessions: { id: string }[]) {
  return sessions.map((session) => session.id);
}

describe("flattenSessionPages", () => {
  it("keeps the first occurrence of a row that repeats across pages", () => {
    expect(ids(flattenSessionPages([page("a", "b"), page("b", "c")]))).toStrictEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("keeps page order for distinct rows", () => {
    expect(ids(flattenSessionPages([page("a", "b"), page("c")]))).toStrictEqual(["a", "b", "c"]);
  });
});
