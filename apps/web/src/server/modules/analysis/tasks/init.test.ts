import { readFileSync } from "node:fs";

import { join } from "pathe";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(import.meta.dirname, "init.ts"), "utf8");

describe("analysis task reliability analytics", () => {
  it("covers every platform lifecycle hook", () => {
    expect(source).toContain("tasks.onComplete");
    expect(source).toContain("tasks.onCancel");
    expect(source).toContain("tasks.onFailure");
  });

  it("distinguishes platform failures from in-task failures", () => {
    expect(source).toContain('source: "platform"');
  });

  it("labels each platform trigger distinctly", () => {
    expect(source).toContain('"task_timeout"');
    expect(source).toContain('"manual_cancel"');
    expect(source).toContain('"platform_failure"');
  });

  it("never forwards the raw error text to analytics", () => {
    expect(source).not.toMatch(/trackServerEvent\([^)]*errorMsg/);
  });

  it("reports a null duration rather than zero for platform failures", () => {
    expect(source).toContain("duration_ms: null");
  });
});
