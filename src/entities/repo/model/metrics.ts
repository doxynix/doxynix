import type { UiRepoListItem } from "@/shared/api/trpc";

export type Props = {
  id: string;
  label: string;
  score: number | null | undefined;
};

export function getMetrics(repo: UiRepoListItem): Props[] {
  return [
    {
      id: "health",
      label: "Health",
      score: repo.healthScore,
    },
    {
      id: "security",
      label: "Security",
      score: repo.securityScore,
    },
    {
      id: "techDebt",
      label: "Tech Debt",
      score: repo.techDebtScore,
    },
    {
      id: "complexity",
      label: "Complexity",
      score: repo.complexityScore,
    },
    {
      id: "onboarding",
      label: "Onboarding",
      score: repo.onboardingScore,
    },
  ];
}
