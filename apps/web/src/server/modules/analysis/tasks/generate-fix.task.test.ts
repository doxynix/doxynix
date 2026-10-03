import { readFileSync } from "node:fs";

import { join } from "pathe";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(import.meta.dirname, "generate-fix.task.ts"), "utf8");

describe("generate-fix analytics", () => {
  it("tracks both terminal outcomes", () => {
    expect(source).toContain('"fix_generated"');
    expect(source).toContain('"fix_generation_failed"');
  });

  it("sends only counts, never file contents or diffs", () => {
    expect(source).toContain("fixed_files_count: fixResult.fixedFiles.length");
    expect(source).toContain("unique_files_count: uniqueFiles.length");
    expect(source).not.toMatch(/trackServerEvent\([^)]*newContent/);
    expect(source).not.toMatch(/trackServerEvent\([^)]*diffs/);
    expect(source).not.toMatch(/trackServerEvent\([^)]*fileContents/);
  });

  it("never leaks the error message", () => {
    expect(source).not.toMatch(/trackServerEvent\([^)]*errorMsg/);
  });

  it("uses the payload user id as the distinct id", () => {
    expect(source).toMatch(/trackServerEvent\([\s\S]*?payload\.userId,[\s\S]*?\);/);
  });
});
