import { describe, expect, it } from "vitest";

import { computeShouldDim, matchRepoMapNodes } from "./match-repo-map-nodes";

const NODE = (id: string, label: number | string) => ({ data: { label }, id });

describe("matchRepoMapNodes", () => {
  it("matches nothing for an empty node set", () => {
    expect(matchRepoMapNodes([], "foo").size).toBe(0);
  });

  it("matches every node for an empty query", () => {
    const nodes = [NODE("a", "Alpha"), NODE("b", "Beta")];
    expect(matchRepoMapNodes(nodes, "")).toEqual(new Set(["a", "b"]));
  });

  it("matches by label and by id case-insensitively", () => {
    const nodes = [NODE("alpha", "abc"), NODE("abc", "xyz"), NODE("z", "abc")];
    expect(matchRepoMapNodes(nodes, "ABC")).toEqual(new Set(["alpha", "abc", "z"]));
  });

  it("requires every word to match (AND)", () => {
    const nodes = [NODE("a", "foo bar"), NODE("b", "foo baz"), NODE("c", "foo")];
    expect(matchRepoMapNodes(nodes, "foo bar")).toEqual(new Set(["a"]));
  });

  it("normalizes whitespace inside label", () => {
    const nodes = [NODE("lib", "Typescript Library"), NODE("js", "Javascript")];
    expect(matchRepoMapNodes(nodes, "typescriptlibrary")).toEqual(new Set(["lib"]));
  });

  it("normalizes whitespace inside id", () => {
    const nodes = [NODE("react flow", "xyz"), NODE("plain", "xyz")];
    expect(matchRepoMapNodes(nodes, "reactflow")).toEqual(new Set(["react flow"]));
  });

  it("returns an empty set when nothing matches", () => {
    const nodes = [NODE("a", "alpha")];
    expect(matchRepoMapNodes(nodes, "zzz").size).toBe(0);
  });
});

describe("computeShouldDim", () => {
  it("dims nothing for an empty query", () => {
    expect(computeShouldDim("a", "", new Set(["a"]))).toBe(false);
    expect(computeShouldDim("missing", "", new Set())).toBe(false);
  });

  it("keeps matching nodes visible and dims the rest", () => {
    const ids = new Set(["a"]);
    expect(computeShouldDim("a", "foo", ids)).toBe(false);
    expect(computeShouldDim("b", "foo", ids)).toBe(true);
  });
});
