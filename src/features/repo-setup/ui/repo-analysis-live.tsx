"use client";

import { useRealtimeRun } from "@trigger.dev/react-hooks";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { useTypewriter } from "@/shared/hooks/use-typewriter";
import { Badge } from "@/shared/ui/core/badge";
import { Button } from "@/shared/ui/core/button";
import { Progress } from "@/shared/ui/core/progress";
import { Spinner } from "@/shared/ui/core/spinner";

import { TRIGGER_CONFIG } from "@/server/shared/lib/trigger";

import { AnalysisTerminal } from "./repo-analysis-terminal";
import { useRouter } from "@/i18n/routing";

type Props = { accessToken: string; jobId: string; repoId: string };

export function RepoAnalysisLive({ accessToken, jobId, repoId }: Readonly<Props>) {
  const router = useRouter();
  const { run } = useRealtimeRun(jobId, { accessToken });

  const metadata = run?.metadata ?? {};

  const progress = (metadata[TRIGGER_CONFIG.metadataKeys.progress] as number) ?? 0;
  const statusText =
    (metadata[TRIGGER_CONFIG.metadataKeys.statusMessage] as string) ??
    "Waiting for worker to start...";
  const logs = (metadata[TRIGGER_CONFIG.metadataKeys.taskLogs] as string[]) ?? [];

  const isFinished = run?.status === "COMPLETED";
  const isFailed = run?.status === "FAILED" || run?.status === "CRASHED";

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
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-sm font-medium">
          <span className="flex items-center gap-2">
            Status: <Badge variant="outline">{run?.status ?? "QUEUED"}</Badge>
          </span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} className="h-2 shadow-inner" />
      </div>

      <AnalysisTerminal logs={logs} />

      <div className="flex justify-center gap-4">
        {isFinished && (
          <Button
            size="lg"
            onClick={() => router.push(`/dashboard/repo/result/${repoId}`)}
            className="px-10"
          >
            View Results
          </Button>
        )}
        {(isFinished || isFailed) && (
          <Button variant="outline" onClick={() => router.refresh()}>
            Start New Audit
          </Button>
        )}
      </div>
    </div>
  );
}
