import { describe, expect, it } from "vitest";

import type { AuthorGroup } from "./thanks.types";
import { filterAuthorGroups } from "./thanks-filters";

const GROUP = (author: string, packages: string[]): AuthorGroup => ({
  author,
  authorLink: "",
  avatar: null,
  packages: packages.map((name) => ({ license: "MIT", name })),
});

describe("filterAuthorGroups", () => {
  it("returns all groups for an empty search", () => {
    const groups = [GROUP("acme", ["foo", "bar"]), GROUP("other", ["baz"])];
    expect(filterAuthorGroups(groups, "")).toEqual(groups);
  });

  it("is case-insensitive and trims the query", () => {
    const groups = [GROUP("Acme Corp", ["Foo"])];
    const result = filterAuthorGroups(groups, "  ACME  ");
    expect(result).toEqual(groups);
  });

  it("keeps all packages when the author matches", () => {
    const groups = [GROUP("acme", ["foo", "bar"])];
    expect(filterAuthorGroups(groups, "acme")).toEqual(groups);
  });

  it("keeps only matching packages when only a package matches", () => {
    const acme = GROUP("acme", ["foo", "bar"]);
    const result = filterAuthorGroups([acme], "foo");
    expect(result).toEqual([
      {
        ...acme,
        packages: acme.packages.filter((pkg) => pkg.name === "foo"),
      },
    ]);
  });

  it("drops groups with no matching package", () => {
    const groups = [GROUP("acme", ["foo"]), GROUP("other", ["zzz"])];
    const result = filterAuthorGroups(groups, "foo");
    expect(result).toEqual([GROUP("acme", ["foo"])]);
  });

  it("matches package names case-insensitively", () => {
    const groups = [GROUP("acme", ["ReactLib"])];
    expect(filterAuthorGroups(groups, "reactlib")).toEqual(groups);
  });
});
