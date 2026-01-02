import { Activity, AlertCircle, FileText, FolderGit2, Loader2 } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Card, CardContent } from "@/shared/ui/card";

import { api } from "@/server/trpc/server";

export async function StatCard() {
  const data = await (await api()).analytics.getDashboardStats();

  const stats = [
    {
      label: "Репозиториев",
      value: data.repoCount,
      icon: FolderGit2,
      color: "text-blue",
    },
    {
      label: "Документаций",
      value: data.docsCount,
      icon: FileText,
      color: "text-success",
    },
    {
      label: "Требуют внимания",
      value: data.failedAnalyses,
      icon: AlertCircle,
      color: "text-error",
    },
    {
      label: "В обработке",
      value: data.pendingAnalyses,
      icon: Loader2,
      color: "text-warning",
    },
    {
      label: "Всего анализов",
      value: data.analysisCount,
      icon: Activity,
      color: "text-muted-foreground",
    },
  ];

  return (
    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {stats.map((stat) => (
        <Card key={stat.label} className="bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-muted rounded-md p-2">
                <stat.icon className={cn("h-4 w-4", stat.color)} />
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
