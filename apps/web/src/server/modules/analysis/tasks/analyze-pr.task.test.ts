import { readFileSync } from "node:fs";

import { join } from "pathe";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(import.meta.dirname, "analyze-pr.task.ts"), "utf8");

describe("analyze-pr analytics", () => {
  it("tracks both terminal outcomes", () => {
    expect(source).toContain('"pr_analysis_completed"');
    expect(source).toContain('"pr_analysis_failed"');
  });

  it("uses the healed finding count, not the synthetic fallback", () => {
    expect(source).toMatch(/findings_count: healedFindings\.length/);
  });

  it("marks retries so a logical run is not counted twice as one failure", () => {
    expect(source).toContain('source: "task_attempt"');
  });

  it("never leaks the error message or the AI summary", () => {
    expect(source).not.toMatch(/trackServerEvent\([^)]*errorMsg/);
    expect(source).not.toMatch(/trackServerEvent\([^)]*result\.summary/);
  });

  it("never leaks GitHub identity or file paths", () => {
    expect(source).not.toMatch(/trackServerEvent\([^)]*payload\.owner/);
    expect(source).not.toMatch(/trackServerEvent\([^)]*payload\.repoName/);
    expect(source).not.toMatch(/trackServerEvent\([^)]*filePath/);
  });
});
