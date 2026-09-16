import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appLogger: { debug: vi.fn(), error: vi.fn(), flush: vi.fn(), info: vi.fn(), warn: vi.fn() },
  enhance: vi.fn((db: unknown) => db),
  getDashboardStats: vi.fn(),
  getTrends: vi.fn(),
}));

vi.mock("@/server/core/app-logger", () => ({ appLogger: mocks.appLogger }));
vi.mock("@zenstackhq/runtime", () => ({ enhance: mocks.enhance }));
vi.mock("@/server/utils/request-context", () => ({
  buildRequestStore: vi.fn((o: unknown) => ({ ...(o as object), requestId: "req-1" })),
  requestContext: {
    getStore: vi.fn(() => null),
    run: vi.fn((_s: unknown, fn: () => unknown) => fn()),
  },
  resolveRequestId: vi.fn(() => "req-1"),
}));
vi.mock("@/shared/config/env.flags", () => ({ IS_PROD: false }));
vi.mock("./analytics.service", () => ({
  analyticsService: { getDashboardStats: mocks.getDashboardStats, getTrends: mocks.getTrends },
}));

import { createCallerFactory } from "@/server/core/trpc/init";

import { analyticsRouter } from "./analytics.router";

// Must satisfy DashboardStatsSchema (output-validated by tRPC at call time).
const dashboardStatsFixture = {
  analysisStats: { failed: 1, new: 2, pending: 3, success: 4, total: 10 },
  highlights: {
    mostCritical: { name: "repo-a", score: 12.5 },
    topPerformer: { name: "repo-b", score: 95.2 },
  },
  languages: [
    { color: "#3178c6", name: "TypeScript", value: 1234 },
    { color: "#f1e05a", name: "JavaScript", value: 567 },
  ],
  overview: {
    avgScores: { complexity: 3.1, health: 82.4, onboarding: 76.2, security: 88.9, techDebt: 41.7 },
    complexityDelta: 0.4,
    criticalRepoCount: 1,
    docsCount: 42,
    healthDelta: 2.3,
    onboardingDelta: -1.1,
    repoCount: 12,
    securityDelta: 0.9,
    techDebtDelta: -3.2,
    totalLoc: 456_789,
  },
  recentActivity: [
    {
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      id: "7f9c0c52-6f0d-4f6b-9c5e-3d4e5f6a7b8c",
      progress: 100,
      repoName: "doxynix",
      repoOwner: "ivan",
      status: "DONE",
    },
  ],
  risks: {
    busFactorRepos: 2,
    topCoupling: [
      { commits: 12, from_path: "src/a.ts", repo_name: "doxynix", to_path: "src/b.ts" },
    ],
    topHotspots: [{ path: "src/hot.ts", repo_name: "doxynix", score: 87 }],
  },
};

const trendsFixture = [
  {
    complexity: 1,
    date: "2026-01-01",
    fullDate: "2026-01-01T00:00:00.000Z",
    health: 2,
    onboarding: 3,
    security: 4,
    techDebt: 5,
  },
];

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    db: {},
    prisma: {},
    redis: null,
    req: {},
    requestInfo: {},
    session: { user: { id: "9" } },
    ...overrides,
  };
}
const createCaller = createCallerFactory(analyticsRouter);
function makeCaller(overrides?: Record<string, unknown>) {
  return createCaller(makeCtx(overrides) as never);
}

describe("analyticsRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDashboardStats", () => {
    it("returns full dashboard stats fixture", async () => {
      mocks.getDashboardStats.mockResolvedValue(dashboardStatsFixture);

      const caller = makeCaller();
      await expect(caller.getDashboardStats({ period: "30d" })).resolves.toEqual(
        dashboardStatsFixture,
      );

      expect(mocks.getDashboardStats).toHaveBeenCalledWith(
        expect.objectContaining({}),
        { period: "30d" },
        9,
      );
    });

    it("defaults period to 30d when input is empty", async () => {
      mocks.getDashboardStats.mockResolvedValue(dashboardStatsFixture);

      const caller = makeCaller();
      await expect(caller.getDashboardStats({})).resolves.toEqual(dashboardStatsFixture);

      expect(mocks.getDashboardStats).toHaveBeenCalledWith(
        expect.objectContaining({}),
        { period: "30d" },
        9,
      );
    });

    it("rejects when service result fails output validation", async () => {
      mocks.getDashboardStats.mockResolvedValue({ nope: true });

      const caller = makeCaller();
      await expect(caller.getDashboardStats({})).rejects.toThrow("Output validation failed");
    });
  });

  describe("getTrends", () => {
    it("returns trends fixture", async () => {
      mocks.getTrends.mockResolvedValue(trendsFixture);

      const caller = makeCaller();
      await expect(caller.getTrends({ period: "7d" })).resolves.toEqual(trendsFixture);

      expect(mocks.getTrends).toHaveBeenCalledWith(
        expect.objectContaining({}),
        { period: "7d" },
        9,
      );
    });

    it("rejects with BAD_REQUEST on invalid input", async () => {
      const caller = makeCaller();
      await expect(caller.getTrends({ from: "not-a-date" } as never)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(mocks.getTrends).not.toHaveBeenCalled();
    });
  });

  it("rejects with UNAUTHORIZED when session is null", async () => {
    const caller = makeCaller({ session: null });
    await expect(caller.getDashboardStats({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(mocks.getDashboardStats).not.toHaveBeenCalled();
  });
});
