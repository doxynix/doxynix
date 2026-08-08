import {
  BookOpenCheck,
  Brain,
  Code2,
  HeartPulse,
  Loader2,
  ShieldCheck,
  TriangleAlert,
  Wrench,
} from "lucide-react";

import { getHealthClasses } from "@/entities/repo/model/get-health-color";

import type { DashboardStats } from "./dashboard.types";

type TFunction = (key: string) => string;

export function getStats(data: DashboardStats, t: TFunction, locale: string) {
  const { analysisStats, overview } = data;

  return [
    {
      className: getHealthClasses(overview.avgScores.health),
      delta: overview.healthDelta,
      description: "Code quality average",
      icon: HeartPulse,
      id: "health",
      label: t("stat_health_score"),
      value: `${overview.avgScores.health}/100`,
    },
    {
      className: "bg-surface-selected text-foreground",
      delta: overview.securityDelta,
      description: "Security audit score",
      icon: ShieldCheck,
      id: "security",
      label: t("stat_security"),
      value: `${overview.avgScores.security}/100`,
    },
    {
      className: "bg-brand-ai/10 text-brand-ai",
      delta: overview.complexityDelta,
      description: "Cognitive complexity",
      icon: Brain,
      id: "complexity",
      label: t("stat_complexity"),
      reverseColor: true,
      value: `${overview.avgScores.complexity}/100`,
    },
    {
      className: "bg-brand-docs/10 text-brand-docs",
      delta: overview.onboardingDelta,
      description: "Documentation quality",
      icon: BookOpenCheck,
      id: "onboarding",
      label: t("stat_onboarding"),
      value: `${overview.avgScores.onboarding}/100`,
    },
    {
      className: "bg-foreground/10 text-foreground font-mono",
      description: "Across all repositories",
      icon: Code2,
      id: "loc",
      label: t("stat_total_loc"),
      value: overview.totalLoc.toLocaleString(locale),
    },
    {
      className: "bg-brand-tech/10 text-brand-tech",
      delta: overview.techDebtDelta,
      description: "Refactoring needed",
      icon: Wrench,
      id: "techdebt",
      label: t("stat_tech_debt"),
      reverseColor: true,
      value: `${overview.avgScores.techDebt}/100`,
    },
    {
      className: "bg-warning/10 text-warning",
      description: "Analyses in queue",
      icon: Loader2,
      iconClass: analysisStats.pending > 0 ? "animate-spin" : undefined,
      id: "queue",
      label: t("stat_pending"),
      value: analysisStats.pending,
    },
    {
      className: "bg-destructive/10 text-destructive",
      description: "Needs Attention",
      icon: TriangleAlert,
      id: "criticalRepoCount",
      label: t("stat_critical_repo_count"),
      value: `${overview.criticalRepoCount}`,
    },
  ];
}
