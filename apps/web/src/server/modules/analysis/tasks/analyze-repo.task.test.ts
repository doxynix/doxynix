import { readFileSync } from "node:fs";

import { join } from "pathe";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(import.meta.dirname, "analyze-repo.task.ts"), "utf8");

describe("analyze-repo analytics", () => {
  it("emits a duration on every terminal outcome", () => {
    expect(source).toContain("const startedAt = Date.now()");
    expect(source.match(/duration_ms:/g)).toHaveLength(3);
  });

  it("tracks the queue-to-terminal funnel steps", () => {
    expect(source).toContain('"repo_analysis_completed"');
    expect(source).toContain('"repo_analysis_skipped"');
    expect(source).toContain('"repo_analysis_failed"');
  });

  it("never leaks the error message or stack into analytics", () => {
    expect(source).not.toMatch(/trackServerEvent\([^)]*errorMessage/);
    expect(source).not.toMatch(/trackServerEvent\([^)]*stack/);
  });

  it("never leaks clone paths or commit shas into analytics", () => {
    expect(source).not.toMatch(/trackServerEvent\([^)]*tempClonePath/);
    expect(source).not.toMatch(/trackServerEvent\([^)]*currentSha/);
  });
});
