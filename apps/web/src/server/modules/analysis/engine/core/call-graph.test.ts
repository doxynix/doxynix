import { describe, expect, it } from "vitest";

import { typescriptQuerySpec } from "../extractors/queries/typescript";
import { extractCallSites } from "./call-graph";

describe("extractCallSites", () => {
  it("attributes calls to their enclosing function", async () => {
    const sites = await extractCallSites(
      {
        content: ["function a() { b(); obj.c(); }", "function b() {}"].join("\n"),
        path: "src/calls.ts",
      },
      ".ts",
      typescriptQuerySpec,
    );

    expect(sites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ calleeName: "b", callerName: "a", line: 1 }),
        expect.objectContaining({ calleeName: "c", callerName: "a", line: 1, receiver: "obj" }),
      ]),
    );
  });
});
