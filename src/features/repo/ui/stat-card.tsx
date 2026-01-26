import { Activity, AlertCircle, FileText, FolderGit2, Loader2 } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { cn } from "@/shared/lib/utils";
import { Card, CardContent } from "@/shared/ui/core/card";

import { api } from "@/server/trpc/server";

export async function StatCard() {
  const data = await (await api()).analytics.getDashboardStats();
  const t = await getTranslations("Dashboard");

  const stats = [
    {
      label: t("repo_repositories"),
      value: data.repoCount,
      icon: FolderGit2,
      className: "text-blue",
    },
    {
      label: t("repo_documentations"),
      value: data.docsCount,
      icon: FileText,
      className: "text-success",
    },
    {
      label: t("repo_needs_attention"),
      value: data.failedAnalyses,
      icon: AlertCircle,
      className: "text-error",
    },
    {
      label: t("repo_in_progress"),
      value: data.pendingAnalyses,
      icon: Loader2,
      className: cn("text-warning", data.pendingAnalyses > 0 && "animate-spin"),
    },
    {
      label: t("repo_total_analyses"),
      value: data.analysisCount,
      icon: Activity,
      className: "text-muted-foreground",
    },
  ];

  return (
    <div className="xs:grid-cols-2 mb-8 grid grid-cols-1 gap-4 lg:grid-cols-5">
      {stats.map((stat) => (
        <Card key={stat.label} className="bg-card">
          <CardContent className="xs:p-4">
            <div className="flex items-center gap-3">
              <div className="bg-muted rounded-xl p-2">
                <stat.icon className={cn("h-4 w-4", stat.className)} />
              </div>
              <div>
                <p className="text-2xl font-semibold">{stat.value}</p>
                <p className="text-muted-foreground text-sm">{stat.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
