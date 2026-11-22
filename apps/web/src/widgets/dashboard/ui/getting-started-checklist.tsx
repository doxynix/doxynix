"use client";

import { Fragment, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Circle } from "lucide-react";
import { useTranslations } from "next-intl";

import { useTRPC } from "@/shared/api/trpc";
import { useRouter } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/cn";
import { trackClientEvent } from "@/shared/lib/posthog-client";
import { AppButton } from "@/shared/ui/core/button";
import { Card } from "@/shared/ui/core/card";
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
    return <CheckCircle2 className="size-3.5 shrink-0 text-success" />;
  }

  if (state === "error") {
    return <AlertCircle className="size-3.5 shrink-0 text-destructive" />;
  }

  if (state === "current") {
    return <Spinner className="size-3.5 shrink-0 text-foreground" />;
  }

  return <Circle className="size-3.5 shrink-0 text-muted-foreground" />;
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

  const primaryLabel =
    primaryStep?.id === "github"
      ? t("github_cta")
      : primaryStep?.id === "repo"
        ? t("repo_cta")
        : state.latestAnalysis?.status === "FAILED"
          ? t("analysis_retry")
          : state.latestAnalysis?.status === "PENDING"
            ? t("analysis_running")
            : t("analysis_cta");

  return (
    <Card
      className="gap-3"
      size="compact"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm">{t("title")}</p>
          <p className="mt-0.5 text-muted-foreground text-xs">{t("desc")}</p>
        </div>

        <span className="shrink-0 text-muted-foreground text-xs">
          {t("progress", { done: doneCount, total })}
        </span>

        <AppButton
          className="shrink-0"
          onClick={() => setCollapsed(true)}
          size="sm"
          variant="ghost"
        >
          {t("hide")}
        </AppButton>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {steps.map((step, index) => (
            <Fragment key={step.id}>
              {index > 0 && <span className="hidden h-px min-w-3 flex-1 bg-border sm:block" />}

              <button
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-standard focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/80",
                  step.state === "current" &&
                    "border-border-strong bg-surface-selected text-foreground",
                  step.state === "error" && "border-destructive/30 text-destructive",
                  step.state === "pending" && "border-border text-muted-foreground",
                  step.state === "done" && "border-border text-muted-foreground",
                )}
                onClick={() => handleStepClick(step)}
                type="button"
              >
                <StepIcon state={step.state} />
                {t(LABEL_KEYS[step.id])}
              </button>
            </Fragment>
          ))}
        </div>

        <AppButton
          className="w-full shrink-0 sm:w-auto"
          onClick={() => primaryStep != null && handleStepClick(primaryStep)}
          size="sm"
        >
          {primaryLabel}
        </AppButton>
      </div>
    </Card>
  );
}
