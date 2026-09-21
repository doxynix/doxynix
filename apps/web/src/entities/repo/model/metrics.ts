import type { UiRepoListItem } from "./repo.types";

export type RepoMetricLabelKey =
  | "quality_complexity"
  | "quality_health"
  | "quality_onboarding"
  | "quality_security"
  | "quality_tech_debt";

type Props = {
  id: string;
  labelKey: RepoMetricLabelKey;
  score: null | number | undefined;
};

export function getMetrics(repo: UiRepoListItem): Props[] {
  return [
    {
      id: "health",
      labelKey: "quality_health",
      score: repo.healthScore,
    },
    {
      id: "security",
      labelKey: "quality_security",
      score: repo.securityScore,
    },
    {
      id: "techDebt",
      labelKey: "quality_tech_debt",
      score: repo.techDebtScore,
    },
    {
      id: "complexity",
      labelKey: "quality_complexity",
      score: repo.complexityScore,
    },
    {
      id: "onboarding",
      labelKey: "quality_onboarding",
      score: repo.onboardingScore,
    },
  ];
}
