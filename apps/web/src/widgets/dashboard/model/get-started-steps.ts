import type { RouterOutput } from "@/shared/api/trpc";

type State = RouterOutput["user"]["getOnboardingState"];

export type GettingStartedStepId = "analysis" | "github" | "repo";

export type GettingStartedStepState = "current" | "done" | "error" | "pending";

export type GettingStartedStep = {
  id: GettingStartedStepId;
  state: GettingStartedStepState;
};

export function isOnboardingActivated(state: State): boolean {
  return state.activatedAt != null || state.hasCompletedAnalysis;
}

export function getGettingStartedSteps(state: State): GettingStartedStep[] {
  const activated = isOnboardingActivated(state);
  const hasGithub = state.hasGithubInstallation;
  const hasRepo = state.repoCount > 0;
  const analysisFailed = state.latestAnalysis?.status === "FAILED";

  return [
    {
      id: "github",
      state: hasGithub ? "done" : "current",
    },
    {
      id: "repo",
      state: hasRepo ? "done" : hasGithub ? "current" : "pending",
    },
    {
      id: "analysis",
      state: activated ? "done" : analysisFailed ? "error" : hasRepo ? "current" : "pending",
    },
  ];
}
