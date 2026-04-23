"use client";

import { Loader2, ShieldCheck } from "lucide-react";

import { trpc } from "@/shared/api/trpc";
import { cn } from "@/shared/lib/cn";

type Props = {
  prNumber: number;
  repoId: string;
};

export function RepoPullDetailContainer({ prNumber, repoId }: Readonly<Props>) {
  const { data: analysis, isLoading: isAnalysisLoading } = trpc.prAnalysis.getByPRNumber.useQuery({
    prNumber,
    repoId,
  });

  const { data: comments, isLoading: isCommentsLoading } = trpc.prAnalysis.getComments.useQuery(
    { analysisId: analysis?.id ?? "" },
    { enabled: analysis?.id != null }
  );

  if (isAnalysisLoading)
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="animate-spin" />
      </div>
    );

  if (analysis == null) return <div>Analysis not found for this PR.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold">Pull Request #{analysis.prNumber}</h1>
          <p className="text-muted-foreground font-mono text-sm">{analysis.headSha.slice(0, 7)}</p>
        </div>

        <div className="flex items-center gap-4">
          {analysis.riskScore != null && (
            <div className="text-right">
              <p className="text-muted-foreground text-xs tracking-wider uppercase">Risk Score</p>
              <p
                className={cn(
                  "text-3xl font-black",
                  analysis.riskScore > 7
                    ? "text-red-500"
                    : analysis.riskScore > 4
                      ? "text-yellow-500"
                      : "text-green-500"
                )}
              >
                {analysis.riskScore}/10
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <h3 className="flex items-center gap-2 font-semibold">
            <ShieldCheck />
            Detected Issues ({comments?.length ?? 0})
          </h3>

          {isCommentsLoading ? (
            <Loader2 className="mx-auto animate-spin" />
          ) : (
            <div className="flex flex-col gap-4">
              {comments?.map((comment) => (
                <div key={comment.id} className="bg-card rounded-xl border p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
                      {comment.filePath}:{comment.line}
                    </code>
                    <span className="text-muted-foreground text-[10px] font-bold uppercase">
                      {comment.findingType}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed">{comment.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-muted/30 space-y-3 rounded-xl border p-4">
            <h4 className="text-sm font-bold tracking-tighter uppercase">PR Details</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base SHA:</span>{" "}
                <span className="font-mono">{analysis.baseSha.slice(0, 7)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>{" "}
                <span className="text-primary font-bold">{analysis.status}</span>
              </div>
            </div>
          </div>

          <div className="bg-card text-muted-foreground flex aspect-square items-center justify-center rounded-xl border p-4 text-center text-xs">
            Interactive Map Module Coming Soon
          </div>
        </div>
      </div>
    </div>
  );
}
