import { describe, expect, it } from "vitest";

import { resolveAnalysisDisplay } from "./analysis-display";

const base = { dbProgress: null, dbStatus: null, runStatus: null, triggerProgress: 50 };

describe("resolveAnalysisDisplay", () => {
  it("defaults to QUEUED with no statuses", () => {
    const result = resolveAnalysisDisplay(base);
    expect(result).toEqual({
      displayStatus: "QUEUED",
      isFailed: false,
      isFinished: false,
      isPending: false,
      progress: 50,
    });
  });

  it("flags PENDING from the db status", () => {
    const result = resolveAnalysisDisplay({ ...base, dbStatus: "PENDING" });
    expect(result.isPending).toBe(true);
    expect(result.displayStatus).toBe("PENDING");
  });

  it("treats a trigger failure as failed with FAILED status", () => {
    for (const status of ["FAILED", "CRASHED", "TIMED_OUT"]) {
      const result = resolveAnalysisDisplay({ ...base, runStatus: status });
      expect(result.isFailed).toBe(true);
      expect(result.displayStatus).toBe("FAILED");
    }
  });

  it("treats a db failure as failed", () => {
    const result = resolveAnalysisDisplay({ ...base, dbStatus: "FAILED" });
    expect(result.isFailed).toBe(true);
    expect(result.displayStatus).toBe("FAILED");
  });

  it("marks finished when the trigger completes", () => {
    const result = resolveAnalysisDisplay({ ...base, runStatus: "COMPLETED" });
    expect(result).toMatchObject({ displayStatus: "COMPLETED", isFinished: true });
  });

  it("marks finished when the db run is done", () => {
    const result = resolveAnalysisDisplay({ ...base, dbStatus: "DONE" });
    expect(result).toMatchObject({ displayStatus: "COMPLETED", isFinished: true });
  });

  it("gives failure precedence over completion", () => {
    const result = resolveAnalysisDisplay({ ...base, dbStatus: "FAILED", runStatus: "COMPLETED" });
    expect(result.isFailed).toBe(true);
    expect(result.displayStatus).toBe("FAILED");
  });

  it("prefers runStatus for the in-between display", () => {
    const result = resolveAnalysisDisplay({ ...base, dbStatus: "PENDING", runStatus: "RUNNING" });
    expect(result.displayStatus).toBe("RUNNING");
  });

  it("takes the higher of db and trigger progress", () => {
    expect(resolveAnalysisDisplay({ ...base, dbProgress: 80 }).progress).toBe(80);
    expect(resolveAnalysisDisplay({ ...base, dbProgress: 20 }).progress).toBe(50);
    expect(resolveAnalysisDisplay({ ...base, dbProgress: null }).progress).toBe(50);
  });
});
