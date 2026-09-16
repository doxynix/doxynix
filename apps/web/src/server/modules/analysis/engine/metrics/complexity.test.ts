import { describe, expect, it } from "vitest";

import type { HealthScoreParams } from "../core/metrics.types";
import { calculateHealthScore } from "./complexity";

describe("calculateHealthScore", () => {
  const mockRepo = {
    createdAt: new Date(),
    description: null,
    id: "1",
    name: "test-repo",
    ownerId: "user-1",
    pushedAt: new Date(),
    updatedAt: new Date(),
    url: "https://github.com/test/repo",
  } as any;

  const baseParams: HealthScoreParams = {
    busFactor: 3,
    complexityScore: 70,
    dependencyCycles: 2,
    docDensity: 0.5,
    duplicationPercentage: 10,
    repo: mockRepo,
    securityScore: 80,
    techDebtScore: 75,
  };

  it("should calculate score within 0-100 range", () => {
    const score = calculateHealthScore(baseParams);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("should return 0 for worst-case inputs and old push date", () => {
    const worst = calculateHealthScore({
      ...baseParams,
      busFactor: 0,
      complexityScore: 0,
      dependencyCycles: 10,
      docDensity: 0,
      duplicationPercentage: 100,
      repo: { ...mockRepo, pushedAt: new Date(0) },
      securityScore: 0,
      techDebtScore: 0,
    });
    expect(worst).toBe(0);
  });

  it("should return 100 for perfect-case inputs", () => {
    const best = calculateHealthScore({
      ...baseParams,
      busFactor: 10,
      complexityScore: 100,
      dependencyCycles: 0,
      docDensity: 1,
      duplicationPercentage: 0,
      securityScore: 100,
      techDebtScore: 100,
    });
    expect(best).toBe(100);
  });

  it("should award different bonuses based on push recency", () => {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    const recent = calculateHealthScore({
      ...baseParams,
      repo: { ...mockRepo, pushedAt: new Date(now - 5 * DAY) },
    });

    const active = calculateHealthScore({
      ...baseParams,
      repo: { ...mockRepo, pushedAt: new Date(now - 45 * DAY) },
    });

    const stale = calculateHealthScore({
      ...baseParams,
      repo: { ...mockRepo, pushedAt: new Date(now - 120 * DAY) },
    });

    expect(recent).toBeGreaterThan(active);
    expect(active).toBeGreaterThan(stale);
  });

  it("should handle null pushedAt by assuming current date (recent bonus)", () => {
    const nullPush = calculateHealthScore({
      ...baseParams,
      repo: { ...mockRepo, pushedAt: null },
    });
    const nowPush = calculateHealthScore({
      ...baseParams,
      repo: { ...mockRepo, pushedAt: new Date() },
    });
    expect(nullPush).toBe(nowPush);
  });

  it("should reflect significant changes in component metrics", () => {
    // Make base score more sensitive to docDensity change
    const baseParamsWithHighImpact = {
      ...baseParams,
      complexityScore: 100,
      securityScore: 100,
      techDebtScore: 100,
    };
    const lowDoc = calculateHealthScore({ ...baseParamsWithHighImpact, docDensity: 0.0 });
    const highDoc = calculateHealthScore({ ...baseParamsWithHighImpact, docDensity: 1.0 });
    expect(highDoc).toBeGreaterThan(lowDoc);

    const noDup = calculateHealthScore({ ...baseParams, duplicationPercentage: 0 });
    const highDup = calculateHealthScore({ ...baseParams, duplicationPercentage: 80 });
    expect(noDup).toBeGreaterThan(highDup);

    const lowBus = calculateHealthScore({ ...baseParams, busFactor: 1 });
    const highBus = calculateHealthScore({ ...baseParams, busFactor: 10 });
    expect(highBus).toBeGreaterThan(lowBus);
  });
});
