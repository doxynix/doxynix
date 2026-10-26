"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Circle } from "lucide-react";
import { useTranslations } from "next-intl";

import { useTRPC } from "@/shared/api/trpc";
import { useRouter } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/cn";
import { trackClientEvent } from "@/shared/lib/posthog-client";
import { AppButton } from "@/shared/ui/core/button";
import { Card, CardContent } from "@/shared/ui/core/card";
import { Spinner } from "@/shared/ui/core/spinner";

import { useCreateRepoActions } from "@/entities/repo/model/use-create-repo-dialog.store";

import {
  type GettingStartedStep,
  getGettingStartedSteps,
  isOnboardingActivated,
} from "../model/get-started-steps";

const LABEL_KEYS = {
  analysis: "step_analysis",
  github: "step_github",
  repo: "step_repo",
} as const;

function StepIcon({ state }: Readonly<{ state: GettingStartedStep["state"] }>) {
  if (state === "done") {
    return <CheckCircle2 className="text-success" />;
  }

  if (state === "error") {
    return <AlertCircle className="text-destructive" />;
  }

  if (state === "current") {
    return <Spinner className="text-foreground" />;
  }

  return <Circle className="text-muted-foreground" />;
}

export function GettingStartedChecklist() {
  const trpc = useTRPC();
  const router = useRouter();
  const t = useTranslations("OnboardingChecklist");
  const { setOpen } = useCreateRepoActions();
  const { data: state } = useQuery(trpc.user.getOnboardingState.queryOptions());
  const collapse = useMutation(trpc.user.setOnboardingChecklistCollapsed.mutationOptions());
  const [localCollapsed, setLocalCollapsed] = useState<boolean | null>(null);

  if (state == null || isOnboardingActivated(state)) {
    return null;
  }

  const collapsed = localCollapsed ?? state.checklistDismissedAt != null;
  const steps = getGettingStartedSteps(state);
  const doneCount = steps.filter((step) => step.state === "done").length;
  const total = steps.length;

  const setCollapsed = (next: boolean) => {
    setLocalCollapsed(next);
    trackClientEvent("onboarding_checklist_toggled", { collapsed: next });
    collapse.mutate({ collapsed: next });
  };

  const handleStepClick = (step: GettingStartedStep) => {
    trackClientEvent("onboarding_checklist_step_clicked", { step: step.id });

    if (step.id === "github") {
      router.push("/welcome?resume=1");
      return;
    }

    if (step.id === "repo") {
      setOpen(true);
      return;
    }

    if (state.firstRepo != null) {
      const intent = state.intent?.toLowerCase();
      const suffix = intent == null ? "" : `&intent=${intent}`;
      router.push(
        `/dashboard/repo/${encodeURIComponent(state.firstRepo.owner)}/${encodeURIComponent(state.firstRepo.name)}/analyze?onboarding=1${suffix}`,
      );
    }
  };

  if (collapsed) {
    return (
      <AppButton
        className="w-fit gap-2"
        onClick={() => setCollapsed(false)}
        size="sm"
        variant="outline"
      >
        <StepIcon state={doneCount === total ? "done" : "current"} />
        {t("show", { done: doneCount, total })}
      </AppButton>
    );
  }

  const primaryStep = steps.find((step) => step.state !== "done") ?? steps[0];

  return (
    <Card className="border-border-strong/60 bg-card/60">
      <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-1">
          <p className="font-semibold">{t("title")}</p>
          <p className="text-muted-foreground text-sm">{t("desc")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {steps.map((step) => (
            <button
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-standard",
                step.state === "current" && "border-border-strong bg-surface-selected",
                step.state === "error" && "border-destructive/40 text-destructive",
                step.state === "pending" && "text-muted-foreground",
              )}
              key={step.id}
              onClick={() => handleStepClick(step)}
              type="button"
            >
              <StepIcon state={step.state} />
              {t(LABEL_KEYS[step.id])}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">
            {t("progress", { done: doneCount, total })}
          </span>
          <AppButton
            onClick={() => setCollapsed(true)}
            size="sm"
            variant="ghost"
          >
            {t("hide")}
          </AppButton>
          <AppButton
            onClick={() => primaryStep != null && handleStepClick(primaryStep)}
            size="sm"
          >
            {primaryStep?.id === "github" && t("github_cta")}
            {primaryStep?.id === "repo" && t("repo_cta")}
            {primaryStep?.id === "analysis" &&
              (state.latestAnalysis?.status === "FAILED"
                ? t("analysis_retry")
                : state.latestAnalysis?.status === "PENDING"
                  ? t("analysis_running")
                  : t("analysis_cta"))}
          </AppButton>
        </div>
      </CardContent>
    </Card>
  );
}
