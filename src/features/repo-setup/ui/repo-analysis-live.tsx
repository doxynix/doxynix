"use client";

import { useRealtimeRun } from "@trigger.dev/react-hooks";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { z } from "zod";

import { trpc } from "@/shared/api/trpc";
import { TRIGGER_CONFIG } from "@/shared/constants/trigger";
import { useRouter } from "@/shared/i18n/routing";
import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import { Progress } from "@/shared/ui/core/progress";
import { Spinner } from "@/shared/ui/core/spinner";

import { AnalysisTerminal } from "./repo-analysis-terminal";

type Props = {
  accessToken: string;
  analysisId: string;
  jobId: string;
  name: string;
  owner: string;
  repoId: string;
};

const parseProgress = (val: unknown) => z.number().min(0).max(100).catch(0).parse(val);
const parseStatusMessage = (val: unknown) => z.string().catch("Analyzing repository…").parse(val);
const parseTaskLogs = (val: unknown) => z.array(z.string()).catch([]).parse(val);

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

  const dbProgress = latestAnalysis?.progress;
  const progress =
    typeof dbProgress === "number" && dbProgress > triggerProgress ? dbProgress : triggerProgress;

  const isDbDone = latestAnalysis?.status === "DONE";
  const isDbFailed = latestAnalysis?.status === "FAILED";
  const isTriggerFinished = run?.status === "COMPLETED";
  const isTriggerFailed =
    run?.status === "FAILED" || run?.status === "CRASHED" || run?.status === "TIMED_OUT";

  const isFailed = isTriggerFailed || isDbFailed;
  const isFinished = !isFailed && (isTriggerFinished || isDbDone);
  const isPending = latestAnalysis?.status === "PENDING";

  let displayStatus: string;
  if (isFailed) {
    displayStatus = "FAILED";
  } else if (isFinished) {
    displayStatus = "COMPLETED";
  } else {
    displayStatus = run?.status ?? latestAnalysis?.status ?? "QUEUED";
  }

  const handleCancel = (repoId: string, analysisId: string) => {
    cancelMutation.mutate(
      { analysisId },
      {
        onSuccess: () => {
          void utils.analysis.getLatest.invalidate({ repoId }).then(() => {
            router.refresh();
          });
        },
      }
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-10">
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          {isFinished ? (
            <div className="bg-success/10 rounded-full p-3">
              <CheckCircle2 className="text-success size-10" />
            </div>
          ) : isFailed ? (
            <div className="bg-destructive/10 rounded-full p-3">
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
          <p className="text-muted-foreground text-sm">{triggerStatusText}</p>
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

      <AnalysisTerminal logs={logs} />

      <div className="flex justify-center gap-4">
        {isFinished && (
          <AppButton onClick={() => router.push(`/dashboard/repo/${owner}/${name}`)}>
            View Results
          </AppButton>
        )}
        {(isFinished || isFailed) && (
          <AppButton variant="outline" onClick={() => handleCancel(repoId, analysisId)}>
            Start New Audit
          </AppButton>
        )}
        {isPending && (
          <AppButton variant="destructive" onClick={() => handleCancel(repoId, analysisId)}>
            Cancel
          </AppButton>
        )}
      </div>
    </div>
  );
}
