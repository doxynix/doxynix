"use client";

import { useRealtimeRun } from "@trigger.dev/react-hooks";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { trpc } from "@/shared/api/trpc";
import { TRIGGER_CONFIG } from "@/shared/constants/trigger";
import { useRouter } from "@/shared/i18n/routing";
import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import { Progress } from "@/shared/ui/core/progress";
import { Spinner } from "@/shared/ui/core/spinner";

import { AnalysisTerminal } from "./repo-analysis-terminal";

type Props = { accessToken: string; jobId: string; repoId: string };

export function RepoAnalysisLive({ accessToken, jobId, repoId }: Readonly<Props>) {
  const router = useRouter();
  const { run } = useRealtimeRun(jobId, { accessToken });

  const { data: latestAnalysis } = trpc.analysis.getLatest.useQuery(
    { repoId },
    { refetchInterval: (query) => (query.state.data?.status === "PENDING" ? 4000 : false) }
  );

  const metadata = run?.metadata ?? {};

  const triggerProgress = metadata[TRIGGER_CONFIG.metadataKeys.progress] as number | undefined;
  const triggerStatusText = metadata[TRIGGER_CONFIG.metadataKeys.statusMessage] as
    | string
    | undefined;
  const logs = metadata[TRIGGER_CONFIG.metadataKeys.taskLogs] as string[] | undefined;

  const dbProgress = latestAnalysis?.progress;
  const progress =
    typeof dbProgress === "number" && dbProgress > (triggerProgress ?? 0)
      ? dbProgress
      : (triggerProgress ?? dbProgress ?? 0);

  const statusText = triggerStatusText ?? latestAnalysis?.message ?? "Analyzing repository…";

  const isDbDone = latestAnalysis?.status === "DONE";
  const isDbFailed = latestAnalysis?.status === "FAILED";
  const isTriggerFinished = run?.status === "COMPLETED";
  const isTriggerFailed = run?.status === "FAILED" || run?.status === "CRASHED";

  const isFinished = isTriggerFinished || isDbDone;
  const isFailed = isTriggerFailed || isDbFailed;

  const displayStatus = isFinished
    ? "COMPLETED"
    : isFailed
      ? "FAILED"
      : (run?.status ?? latestAnalysis?.status ?? "QUEUED");

  return (
    <div className="animate-in fade-in mx-auto max-w-4xl space-y-8 py-10 duration-500">
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          {isFinished ? (
            <div className="rounded-full bg-green-500/10 p-3 ring-1 ring-green-500/20">
              <CheckCircle2 className="size-10 text-green-500" />
            </div>
          ) : isFailed ? (
            <div className="bg-destructive/10 ring-destructive/20 rounded-full p-3 ring-1">
              <AlertCircle className="text-destructive size-10" />
            </div>
          ) : (
            <Spinner className="size-10" />
          )}
        </div>

        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">
            {isFinished
              ? "Analysis Complete"
              : isFailed
                ? "Analysis Failed"
                : "Analyzing Repository"}
          </h2>
          <p className="text-muted-foreground text-sm">{statusText}</p>
          {!isFinished && !isFailed && progress >= 85 && (
            <p className="text-muted-foreground text-xs">
              Generating documentation (README, API, Architecture…). This step can take several
              minutes after the AI analysis finishes.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-sm font-medium">
          <span className="flex items-center gap-2">
            Status: <AppBadge variant="outline">{displayStatus}</AppBadge>
          </span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} indicatorClassName="bg-foreground" />
      </div>

      <AnalysisTerminal logs={logs ?? []} />

      <div className="flex justify-center gap-4">
        {isFinished && (
          <AppButton
            size="lg"
            onClick={() => router.push(`/dashboard/repo/result/${repoId}`)}
            className="px-10"
          >
            View Results
          </AppButton>
        )}
        {(isFinished || isFailed) && (
          <AppButton variant="outline" onClick={() => router.refresh()}>
            Start New Audit
          </AppButton>
        )}
      </div>
    </div>
  );
}
