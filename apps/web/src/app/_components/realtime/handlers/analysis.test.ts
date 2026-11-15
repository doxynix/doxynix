import type * as Ably from "ably";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { REALTIME_CONFIG } from "@/shared/config/realtime";

import type { RealtimeDeps } from "../deps";
import { analysisHandlers } from "./analysis";

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const { invalidateMock, setQueriesDataMock } = vi.hoisted(() => ({
  invalidateMock: vi.fn(),
  setQueriesDataMock: vi.fn(),
}));

const filters = {
  dashboardStats: ["analytics.getDashboardStats"],
  getByRepository: ["analysis.getByRepository"],
  getHistory: ["analysis.getHistory"],
  getLatest: ["analysis.getLatest"],
  getOnboardingState: ["user.getOnboardingState"],
  getStagedFiles: ["analysis.getStagedFiles"],
  getVersionRef: ["analysis.getVersionRef"],
};

const trpc = {
  analysis: {
    getByRepository: { pathFilter: () => filters.getByRepository },
    getHistory: { pathFilter: () => filters.getHistory },
    getLatest: { pathFilter: () => filters.getLatest },
    getStagedFiles: { pathFilter: () => filters.getStagedFiles },
    getVersionRef: { pathFilter: () => filters.getVersionRef },
  },
  analytics: { getDashboardStats: { pathFilter: () => filters.dashboardStats } },
  user: { getOnboardingState: { pathFilter: () => filters.getOnboardingState } },
};

const queryClient = { invalidateQueries: invalidateMock, setQueriesData: setQueriesDataMock };

function handler(event: string) {
  const handlers = analysisHandlers({
    invalidate: invalidateMock,
    queryClient,
    t: (key: string) => key,
    trpc,
  } as unknown as RealtimeDeps);
  const registered = handlers[event];

  if (registered == null) {
    throw new Error(`No handler registered for ${event}`);
  }

  return registered;
}

function progressMessage(status: string): Ably.Message {
  return {
    data: { analysisId: "analysis-1", message: "stage", progress: 50, status },
  };
}

function invalidatedFilters(): unknown[] {
  return invalidateMock.mock.calls.map(([filter]) => filter);
}

describe("analysis realtime handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("patches the dashboard on a milestone without refetching anything", () => {
    handler(REALTIME_CONFIG.events.user.analysisProgress)(progressMessage("PENDING"));

    expect(setQueriesDataMock).toHaveBeenCalledTimes(1);
    expect(setQueriesDataMock.mock.calls[0]?.[0]).toBe(filters.dashboardStats);
    expect(invalidateMock).not.toHaveBeenCalled();
  });

  it("leaves the analysis queries to `analysisUpdated` when a run completes", () => {
    handler(REALTIME_CONFIG.events.user.analysisProgress)(progressMessage("DONE"));

    expect(invalidateMock).toHaveBeenCalledTimes(1);
    expect(invalidatedFilters()).toStrictEqual([undefined]);
    expect(setQueriesDataMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes the analysis queries on failure, where `analysisUpdated` never arrives", () => {
    handler(REALTIME_CONFIG.events.user.analysisProgress)(progressMessage("FAILED"));

    expect(invalidateMock).toHaveBeenCalledTimes(4);
    expect(invalidatedFilters()).toStrictEqual([
      undefined,
      filters.getLatest,
      filters.getHistory,
      filters.getVersionRef,
    ]);
    expect(invalidatedFilters()).not.toContain(filters.getOnboardingState);
  });

  it("invalidates the analysis and onboarding queries on `analysisUpdated`", () => {
    handler(REALTIME_CONFIG.events.user.analysisUpdated)(progressMessage("DONE"));

    expect(invalidatedFilters()).toStrictEqual([
      filters.getLatest,
      filters.getHistory,
      filters.getVersionRef,
      filters.getOnboardingState,
    ]);
    expect(invalidatedFilters()).not.toContain(filters.getStagedFiles);
    expect(invalidatedFilters()).not.toContain(filters.getByRepository);
  });
});
