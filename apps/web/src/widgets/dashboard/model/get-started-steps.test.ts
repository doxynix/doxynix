import { describe, expect, it } from "vitest";

import type { RouterOutput } from "@/shared/api/trpc";

import { getGettingStartedSteps } from "./get-started-steps";

type State = RouterOutput["user"]["getOnboardingState"];

function makeState(overrides: Partial<State> = {}): State {
  return {
    activatedAt: null,
    checklistDismissedAt: null,
    completedAt: null,
    firstRepo: null,
    hasCompletedAnalysis: false,
    hasGithubAccount: false,
    hasGithubInstallation: false,
    intent: null,
    latestAnalysis: null,
    repoCount: 0,
    step: "welcome",
    ...overrides,
  };
}

describe("getGettingStartedSteps", () => {
  it("starts at GitHub when nothing is connected", () => {
    const steps = getGettingStartedSteps(makeState());

    expect(steps.map((step) => [step.id, step.state])).toEqual([
      ["github", "current"],
      ["repo", "pending"],
      ["analysis", "pending"],
    ]);
  });

  it("moves to repository after GitHub is installed", () => {
    const steps = getGettingStartedSteps(
      makeState({ hasGithubAccount: true, hasGithubInstallation: true }),
    );

    expect(steps.map((step) => [step.id, step.state])).toEqual([
      ["github", "done"],
      ["repo", "current"],
      ["analysis", "pending"],
    ]);
  });

  it("moves to analysis after a repository exists", () => {
    const steps = getGettingStartedSteps(
      makeState({
        firstRepo: { id: "repo-1", name: "api", owner: "acme" },
        hasGithubAccount: true,
        hasGithubInstallation: true,
        repoCount: 1,
      }),
    );

    expect(steps.map((step) => [step.id, step.state])).toEqual([
      ["github", "done"],
      ["repo", "done"],
      ["analysis", "current"],
    ]);
  });

  it("marks a failed analysis as an error", () => {
    const steps = getGettingStartedSteps(
      makeState({
        firstRepo: { id: "repo-1", name: "api", owner: "acme" },
        hasGithubInstallation: true,
        latestAnalysis: { id: "analysis-1", progress: 100, status: "FAILED" },
        repoCount: 1,
      }),
    );

    expect(steps.find((step) => step.id === "analysis")?.state).toBe("error");
  });

  it("marks everything done after activation", () => {
    const steps = getGettingStartedSteps(
      makeState({
        activatedAt: new Date("2026-10-25T10:00:00Z"),
        firstRepo: { id: "repo-1", name: "api", owner: "acme" },
        hasGithubInstallation: true,
        repoCount: 1,
      }),
    );

    expect(steps.every((step) => step.state === "done")).toBe(true);
  });

  it("treats an existing completed analysis as activated when activatedAt is null", () => {
    const steps = getGettingStartedSteps(
      makeState({
        firstRepo: { id: "repo-1", name: "api", owner: "acme" },
        hasCompletedAnalysis: true,
        hasGithubInstallation: true,
        repoCount: 1,
      }),
    );

    expect(steps.every((step) => step.state === "done")).toBe(true);
  });
});
