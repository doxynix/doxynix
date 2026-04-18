"use client";

import { useState } from "react";
import { Check, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/shared/api/trpc";
import { Button } from "@/shared/ui/core/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/core/dialog";
import { ScrollArea } from "@/shared/ui/core/scroll-area";
import { Spinner } from "@/shared/ui/core/spinner";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { ExternalLink } from "@/shared/ui/kit/external-link";

type Props = {
  analysisId: string;
  findings: any[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  repoId: string;
};

export function FixAnalysisModal({
  analysisId,
  findings,
  onOpenChange,
  open,
  repoId,
}: Readonly<Props>) {
  const [step, setStep] = useState<"applying" | "preview" | "success">("preview");
  const [fixResult, setFixResult] = useState<any>(null);
  const utils = trpc.useUtils();

  const createFix = trpc.generatedFix.createFix.useMutation({
    onError: (err) => {
      toast.error("Failed to generate fix: " + err.message);
      onOpenChange(false);
    },
    onSuccess: (data) => {
      setFixResult(data);
    },
  });

  const applyFix = trpc.generatedFix.applyFix.useMutation({
    onSuccess: () => {
      setStep("success");
      toast.success("Pull Request created successfully!");
    },
  });

  const handleStartFixing = async () => {
    const filePaths = [...new Set(findings.map((f) => f.filePath))];

    try {
      toast.info("Fetching file contents...");

      const contentsArray = await Promise.all(
        filePaths.map(async (path) => {
          const result = await utils.githubBrowse.getFileContent.fetch({
            path: path,
            repoId: repoId,
          });

          const finalContent = typeof result === "string" ? result : result.content;

          return { content: finalContent, path };
        })
      );

      const fileContents = contentsArray.reduce(
        (acc, curr) => ({
          ...acc,
          [curr.path]: curr.content,
        }),
        {}
      );

      createFix.mutate({
        fileContents,
        findings: findings.map((f) => ({
          file: f.filePath,
          line: f.line,
          suggestion: f.body,
          type: (f.findingType === "optimization" ? "performance" : f.findingType) as any,
        })),
        prAnalysisId: analysisId,
        repoId,
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to fetch source code.");
    }
  };

  const handleApply = () => {
    if (fixResult == null) return;
    setStep("applying");
    applyFix.mutate({
      branch: fixResult.branch,
      estimatedImpact: fixResult.estimatedImpact,
      fixedFiles: fixResult.fixedFiles,
      fixId: fixResult.fixId,
      repoId,
      title: fixResult.title,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "success" ? "Fix Applied" : "AI Code Fix"}
            {createFix.isPending && <Spinner />}
          </DialogTitle>
          <DialogDescription>
            {step === "preview" &&
              "Review the changes proposed by Doxynix before creating a Pull Request."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden py-4">
          {createFix.isPending ? (
            <div className="flex h-64 flex-col items-center justify-center gap-4">
              <Loader2 className="text-primary size-10 animate-spin" />
              <p className="text-muted-foreground text-sm">
                Analysing and refactoring your code...
              </p>
            </div>
          ) : step === "success" ? (
            <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
              <div className="bg-success/10 text-success flex size-12 items-center justify-center rounded-full">
                <Check className="size-6" />
              </div>
              <h3 className="text-xl font-bold">PR Created!</h3>
              <p className="text-muted-foreground">The fix has been pushed to a new branch.</p>
              <Button asChild variant="outline">
                <ExternalLink href={""} className="ml-2 size-4">
                  View on GitHub <GitHubIcon />
                </ExternalLink>
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-full pr-4">
              <div className="space-y-6">
                {fixResult?.diffs.map((diff: any) => (
                  <div key={diff.filePath} className="space-y-2">
                    <div className="bg-muted/50 flex items-center justify-between rounded-lg p-2">
                      <span className="font-mono text-xs">{diff.filePath}</span>
                      <span className="text-success text-[10px]">+{diff.additions} lines</span>
                    </div>
                    {/* Простейший вьюер патча */}
                    <pre className="overflow-x-auto rounded-lg bg-black p-4 text-[11px] leading-relaxed text-white">
                      {diff.patch}
                    </pre>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          {step === "preview" && fixResult != null && (
            <div className="flex w-full items-center justify-between">
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <Zap className="size-3 text-yellow-500" />
                Estimated Impact:{" "}
                <span className="text-foreground font-bold">{fixResult.estimatedImpact}%</span>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button disabled={applyFix.isPending} onClick={handleApply} className="gap-2">
                  {applyFix.isPending && <Spinner />}
                  Apply Fix & Create PR
                </Button>
              </div>
            </div>
          )}
          {fixResult == null && !createFix.isPending && (
            <Button onClick={() => void handleStartFixing()} className="w-full">
              Generate Fixes
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
