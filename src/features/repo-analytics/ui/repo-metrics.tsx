"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/shared/api/trpc";

import type { RepoMetricsItem } from "@/entities/repo/model/repo.types";
import {
  DomainIntelligenceSection,
  PerformanceAndScalingSection,
  RefactoringBacklogSection,
  SnapshotsSection,
  TechDebtAndComplexitySection,
} from "@/entities/repo/ui/repo-analytics-sections";

import {
  ArchitectureAndDataFlowCard,
  ReferenceAndRoutesCard,
  RisksCard,
  SecurityOverviewCard,
} from "../../../entities/repo/ui/repo-analytics-cards";

type Props = { data: NonNullable<RepoMetricsItem>; repoId: string };

export function RepoMetrics({ data, repoId }: Readonly<Props>) {
  const { architecture, domain, onboarding, quality, recommendations, reference, risks, security } =
    data;
  const utils = trpc.useUtils();

  const [runningFixId, setRunningFixId] = useState<null | string>(null);

  const createFixMutation = trpc.analysis.createFix.useMutation({
    onError: (err) => {
      toast.error(`Failed to trigger fix: ${err.message}`);
    },
    onSuccess: (res) => {
      if (res.success === true && res.fixId != null) {
        toast.info("AI patch generation started in the background...");
        setRunningFixId(res.fixId);
      }
    },
  });

  const { data: fixStatus } = trpc.analysis.getById.useQuery(
    { fixId: runningFixId ?? "" },
    {
      enabled: runningFixId != null,
      refetchInterval: (query) => {
        if (query.state.data?.resultJson == null) return 2000;
        return false;
      },
    }
  );

  const stageGeneratedFixMutation = trpc.analysis.stageGeneratedFix.useMutation({
    onError: (err) => {
      toast.error(`Staging failed: ${err.message}`);
      setRunningFixId(null);
    },
    onSuccess: (res) => {
      if (res.success) {
        toast.success(`AI changes successfully staged! Draft count: ${res.stagedCount}`);
        setRunningFixId(null);
        void utils.analysis.getStagedFiles.invalidate({ repoId });
      }
    },
  });

  useEffect(() => {
    if (runningFixId != null && fixStatus?.resultJson != null) {
      stageGeneratedFixMutation.mutate({ fixId: runningFixId, repoId });
    }
  }, [fixStatus, runningFixId, repoId, stageGeneratedFixMutation]);

  const handleTriggerFix = (
    filePath: string,
    finding: {
      line?: null | number;
      message?: null | string;
      suggestion?: string;
      type?: null | string;
    }
  ) => {
    createFixMutation.mutate({
      fileContents: { [filePath]: "" },
      findings: [
        {
          file: filePath,
          line: finding.line ?? 1,
          suggestion: finding.suggestion ?? finding.message ?? undefined,
          type: finding.type ?? "security",
        },
      ],
      repoId,
    });
  };

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ArchitectureAndDataFlowCard reference={reference} />
        <SecurityOverviewCard
          runningFixId={runningFixId}
          security={security}
          onTriggerFix={handleTriggerFix}
        />
      </section>

      <SnapshotsSection architecture={architecture} onboarding={onboarding} quality={quality} />

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ReferenceAndRoutesCard architecture={architecture} />
        <DomainIntelligenceSection domain={domain} />
        <RisksCard risks={risks} />
      </section>

      <TechDebtAndComplexitySection architecture={architecture} recommendations={recommendations} />

      <RefactoringBacklogSection
        recommendations={recommendations}
        runningFixId={runningFixId}
        onTriggerFix={handleTriggerFix}
      />

      <PerformanceAndScalingSection
        recommendations={recommendations}
        runningFixId={runningFixId}
        onTriggerFix={handleTriggerFix}
      />
    </div>
  );
}
