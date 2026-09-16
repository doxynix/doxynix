"use client";

import { useRealtimeRun } from "@trigger.dev/react-hooks";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { trpc } from "@/shared/api/trpc";
import { TRIGGER_CONFIG } from "@/shared/config/trigger";
import { useRouter } from "@/shared/i18n/navigation";
import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import { Progress } from "@/shared/ui/core/progress";
import { Spinner } from "@/shared/ui/core/spinner";

import { resolveAnalysisDisplay } from "../model/analysis-display";
import { parseProgress, parseStatusMessage, parseTaskLogs } from "../model/realtime-parsers";
import { AnalysisTerminal } from "./repo-analysis-terminal";

type Props = {
  accessToken: string;
  analysisId: string;
  jobId: string;
  name: string;
  owner: string;
  repoId: string;
};

export function RepoAnalysisLive({
  accessToken,
  analysisId,
  jobId,
  name,
  owner,
  repoId,
}: Readonly<Props>) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { run } = useRealtimeRun(jobId, { accessToken });

  const { data: latestAnalysis } = trpc.analysis.getLatest.useQuery({ repoId });

  const cancelMutation = trpc.analysis.cancel.useMutation();

  const metadata = run?.metadata ?? {};

  const triggerProgress = parseProgress(metadata[TRIGGER_CONFIG.metadataKeys.progress]);
  const triggerStatusText = parseStatusMessage(metadata[TRIGGER_CONFIG.metadataKeys.statusMessage]);
  const logs = parseTaskLogs(metadata[TRIGGER_CONFIG.metadataKeys.taskLogs]);

  const { displayStatus, isFailed, isFinished, isPending, progress } = resolveAnalysisDisplay({
    dbProgress: latestAnalysis?.progress,
    dbStatus: latestAnalysis?.status ?? null,
    runStatus: run?.status ?? null,
    triggerProgress,
  });

  const handleCancel = (repoId: string, analysisId: string) => {
    cancelMutation.mutate(
      { analysisId },
      {
        onSuccess: () => {
          void utils.analysis.getLatest.invalidate({ repoId }).then(() => {
            router.refresh();
          });
        },
      },
    );
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 py-10">
      <div className="flex flex-col gap-4 text-center">
        <div className="flex justify-center">
          {isFinished ? (
            <div className="rounded-full bg-success/10 p-3">
              <CheckCircle2 className="size-10 text-success" />
            </div>
          ) : isFailed ? (
            <div className="rounded-full bg-destructive/10 p-3">
              <AlertCircle className="size-10 text-destructive" />
            </div>
          ) : (
            <Spinner className="size-10" />
          )}
        </div>

        <div className="flex flex-col gap-1">
          <h2 className="font-bold text-2xl tracking-tight">
            {isFinished
              ? "Analysis Complete"
              : isFailed
                ? "Analysis Failed"
                : "Analyzing Repository"}
          </h2>
          <p className="text-muted-foreground text-sm">{triggerStatusText}</p>
          {!isFinished && !isFailed && progress >= 85 && (
            <p className="text-muted-foreground text-xs">
              Generating documentation (README, API, Architecture…). This step can take several
              minutes after the AI analysis finishes.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex justify-between font-medium text-sm">
          <span className="flex items-center gap-2">
            Status: <AppBadge variant="outline">{displayStatus}</AppBadge>
          </span>
          <span>{progress}%</span>
        </div>
        <Progress
          indicatorClassName="bg-foreground"
          value={progress}
        />
      </div>

      <AnalysisTerminal logs={logs} />

      <div className="flex justify-center gap-4">
        {isFinished && (
          <AppButton onClick={() => router.push(`/dashboard/repo/${owner}/${name}`)}>
            View Results
          </AppButton>
        )}
        {(isFinished || isFailed) && (
          <AppButton
            onClick={() => handleCancel(repoId, analysisId)}
            variant="outline"
          >
            Start New Audit
          </AppButton>
        )}
        {isPending && (
          <AppButton
            onClick={() => handleCancel(repoId, analysisId)}
            variant="destructive"
          >
            Cancel
          </AppButton>
        )}
      </div>
    </div>
  );
}
