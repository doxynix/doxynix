import { describe, expect, it } from "vitest";

import { AnalysisLatestOutputSchema, analysisLatestSelect } from "./analysis-latest.schemas";

const KEYS = [
  "complexityScore",
  "jobId",
  "message",
  "onboardingScore",
  "progress",
  "publicAccessToken",
  "publicId",
  "score",
  "securityScore",
  "status",
  "techDebtScore",
  "updatedAt",
];

const DROPPED_KEYS = [
  "commitSha",
  "createdAt",
  "error",
  "id",
  "logs",
  "metricsJson",
  "repoId",
  "resultJson",
];

const makeRow = (overrides: Record<string, unknown> = {}) => ({
  complexityScore: 70,
  jobId: "job_1",
  message: "Completed successfully",
  onboardingScore: 64,
  progress: 100,
  publicAccessToken: null as null | string,
  publicId: "0195f000-0000-7000-8000-000000000000",
  score: 91,
  securityScore: 88,
  status: "DONE" as const,
  techDebtScore: 12,
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

describe("AnalysisLatestOutputSchema", () => {
  it("exposes exactly the narrowed field set", () => {
    const parsed = AnalysisLatestOutputSchema.parse(makeRow());
    expect(Object.keys(parsed!).sort()).toEqual(KEYS);
  });

  it("accepts the PENDING shape with a minted public access token", () => {
    const parsed = AnalysisLatestOutputSchema.parse(
      makeRow({
        complexityScore: null,
        jobId: "job_2",
        message: null,
        onboardingScore: null,
        progress: 0,
        publicAccessToken: "tok",
        score: null,
        securityScore: null,
        status: "PENDING" as const,
        techDebtScore: null,
      }),
    );
    expect(parsed).toMatchObject({ publicAccessToken: "tok", status: "PENDING" });
  });

  it("accepts null for a repository without an analysis", () => {
    expect(AnalysisLatestOutputSchema.parse(null)).toBeNull();
  });

  it.each(["FAILED", "NEW", "PENDING", "DONE"] as const)("accepts status %s", (status) => {
    expect(AnalysisLatestOutputSchema.safeParse(makeRow({ status })).success).toBe(true);
  });

  it("rejects the pre-narrowing whole row so the leak cannot return", () => {
    const wholeRow = {
      ...makeRow(),
      commitSha: "abc123",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      error: "boom",
      id: 42,
      logs: "line1",
      metricsJson: { fileCount: 1 },
      repoId: 7,
      resultJson: { findings: [] },
    };
    expect(AnalysisLatestOutputSchema.safeParse(wholeRow).success).toBe(false);
  });

  it("rejects an unknown status rather than passing it through", () => {
    expect(AnalysisLatestOutputSchema.safeParse(makeRow({ status: "QUEUED" })).success).toBe(false);
  });

  it("rejects a serialized timestamp, which would mean it parsed post-transform", () => {
    expect(
      AnalysisLatestOutputSchema.safeParse(
        makeRow({ updatedAt: "2026-01-01T00:00:00.000Z" as unknown as Date }),
      ).success,
    ).toBe(false);
  });
});

describe("getLatest select vs AnalysisLatestOutputSchema", () => {
  it("selects exactly the schema keys, minus the per-request publicAccessToken", () => {
    const selected = Object.keys(analysisLatestSelect);
    const schemaKeys = Object.keys(AnalysisLatestOutputSchema.def.innerType.shape);

    expect(selected).toEqual(schemaKeys.filter((key) => key !== "publicAccessToken"));
  });

  it("never re-selects a dropped column", () => {
    for (const key of DROPPED_KEYS) {
      expect(Object.hasOwn(analysisLatestSelect, key)).toBe(false);
    }
  });

  it.each(DROPPED_KEYS)("rejects a payload still carrying the dropped key %s", (key) => {
    const leaked: Record<string, unknown> = {
      ...makeRow(),
      [key]:
        key === "createdAt" || key === "updatedAt"
          ? new Date("2026-01-01T00:00:00.000Z")
          : key === "id" || key === "repoId"
            ? 42
            : key === "metricsJson" || key === "resultJson"
              ? {}
              : "value",
    };

    const result = AnalysisLatestOutputSchema.safeParse(leaked);

    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues.map((issue) => issue.code)).toContain(
      "unrecognized_keys",
    );
  });

  it("accepts the full service response, i.e. select plus the minted token", () => {
    const response = { ...pickSelectedFields(), publicAccessToken: null };

    expect(Object.keys(response).sort()).toEqual(KEYS);
    expect(AnalysisLatestOutputSchema.safeParse(response).success).toBe(true);
  });
});

function pickSelectedFields(): Record<string, unknown> {
  const full: Record<string, unknown> = makeRow();
  const selected: Record<string, unknown> = {};

  for (const key of Object.keys(analysisLatestSelect)) {
    selected[key] = full[key];
  }

  return selected;
}
