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

import type { DashboardStats } from "@/shared/api/trpc";
import { cn } from "@/shared/lib/utils";

type TFunction = (key: string) => string;

export function getStats(data: DashboardStats, t: TFunction, locale: string) {
  const { analysisStats, overview } = data;

  return [
    {
      className: cn(
        "text-success bg-success/10",
        overview.avgHealthScore < 50 && "text-destructive bg-destructive/10",
        overview.avgHealthScore >= 50 &&
          overview.avgHealthScore < 80 &&
          "text-warning bg-warning/10"
      ),
      description: "Code quality average",
      icon: HeartPulse,
      id: "health",
      label: t("stat_health_score"),
      value: `${overview.avgHealthScore}/100`,
    },
    {
      className: "bg-white/10 text-white font-mono",
      description: "Across all repositories",
      icon: Code2,
      id: "loc",
      label: t("stat_total_loc"),
      value: overview.totalLoc.toLocaleString(locale),
    },
    {
      className: "bg-blue-500/10 text-blue-500",
      description: "Security audit score",
      icon: ShieldCheck,
      id: "security",
      label: t("stat_security"),
      value: `${overview.avgSecurityScore}/100`,
    },
    {
      className: "bg-pink-500/10 text-pink-500",
      description: "Cognitive complexity",
      icon: Brain,
      id: "complexity",
      label: t("stat_complexity"),
      value: `${overview.avgComplexityScore}/100`,
    },
    {
      className: "bg-cyan-500/10 text-cyan-500",
      description: "Documentation quality",
      icon: BookOpenCheck,
      id: "onboarding",
      label: t("stat_onboarding"),
      value: `${overview.avgOnboardingScore}/100`,
    },
    {
      className: "bg-orange-500/10 text-orange-500",
      description: "Refactoring needed",
      icon: Wrench,
      id: "techdebt",
      label: t("stat_tech_debt"),
      value: `${overview.avgTechDebtScore}/100`,
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
