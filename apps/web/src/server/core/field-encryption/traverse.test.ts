import { describe, expect, it } from "vitest";

import { traverseTree } from "./traverse";

describe("traverseTree", () => {
  it("visits every nested value with its dotted path", () => {
    const seen: Array<[string, unknown]> = [];
    // Biome's `useSortedKeys` assist fixes this literal's declaration order to
    // `data` before `where`, so that is the DFS order asserted below.
    const input = { args: { data: { name: "x" }, where: { email: "a@b.c" } } };

    traverseTree(
      input,
      (_state, node) => {
        if (typeof node.value === "string") {
          seen.push([node.path.join("."), node.value]);
        }
        return undefined;
      },
      undefined,
    );

    expect(seen).toEqual([
      ["args.data.name", "x"],
      ["args.where.email", "a@b.c"],
    ]);
  });

  it("carries state so a model can change when descending a relation", () => {
    const connections: Record<string, string> = { accounts: "Account" };
    const visited: Array<[string, string]> = [];

    traverseTree(
      { data: { accounts: { accessToken: "tok" } } },
      (model, node) => {
        if (typeof node.value === "string" && node.key === "accessToken") {
          visited.push([model, node.value]);
        }
        return connections[node.key] ?? model;
      },
      "User",
    );

    expect(visited).toEqual([["Account", "tok"]]);
  });

  it("terminates on null, undefined and empty collections", () => {
    for (const input of [null, undefined, 0, "", [], {}, true]) {
      expect(() => traverseTree(input, (s) => s, "User")).not.toThrow();
    }
  });

  it("does not recurse into a self-referencing cycle forever", () => {
    const cyclic: Record<string, unknown> = { name: "a" };
    cyclic.self = cyclic;
    let count = 0;

    expect(() =>
      traverseTree(
        cyclic,
        (s, node) => {
          if (node.type === "string") {
            count += 1;
          }
          return s;
        },
        "User",
      ),
    ).not.toThrow();
    expect(count).toBe(1);
  });
});
