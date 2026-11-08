import { describe, expect, it } from "vitest";

import type { FileTuple } from "@/entities/repo/model/repo-setup.types";

import { resolveSelectedFiles } from "./analysis-payload";

const file = (path: string, type: number): FileTuple => [path, type, "sha", 0];

describe("resolveSelectedFiles", () => {
  it("keeps only selected paths that are files", () => {
    const files = [file("src", 0), file("src/a.ts", 1), file("src/b.ts", 1)];

    expect(resolveSelectedFiles(files, new Set(["src", "src/a.ts"]))).toEqual(["src/a.ts"]);
  });

  it("returns nothing when the file list is missing", () => {
    expect(resolveSelectedFiles(undefined, new Set(["src/a.ts"]))).toEqual([]);
  });

  it("drops selected ids that are absent from the branch", () => {
    expect(resolveSelectedFiles([file("a.ts", 1)], new Set(["gone.ts"]))).toEqual([]);
  });
});
