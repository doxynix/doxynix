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

function repoStepState(hasRepo: boolean, hasGithub: boolean): GettingStartedStepState {
  if (hasRepo) {
    return "done";
  }
  if (hasGithub) {
    return "current";
  }
  return "pending";
}

function analysisStepState(
  activated: boolean,
  analysisFailed: boolean,
  hasRepo: boolean,
): GettingStartedStepState {
  if (activated) {
    return "done";
  }
  if (analysisFailed) {
    return "error";
  }
  if (hasRepo) {
    return "current";
  }
  return "pending";
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
      state: repoStepState(hasRepo, hasGithub),
    },
    {
      id: "analysis",
      state: analysisStepState(activated, analysisFailed, hasRepo),
    },
  ];
}
