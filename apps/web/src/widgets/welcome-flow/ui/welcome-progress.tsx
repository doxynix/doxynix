"use client";

import { useTranslations } from "next-intl";

import type { RouterOutput } from "@/shared/api/trpc";
import { cn } from "@/shared/lib/cn";

type OnboardingStep = RouterOutput["user"]["getOnboardingState"]["step"];

const STEPS = ["welcome", "github", "repo"] as const;

const LABEL_KEYS = {
  github: "step_github",
  repo: "step_repo",
  welcome: "step_profile",
} as const;

export function WelcomeProgress({ step }: Readonly<{ step: OnboardingStep }>) {
  const t = useTranslations("Welcome");
  const index = STEPS.indexOf(step);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          {STEPS.map((item, itemIndex) => (
            <span
              className={cn(
                "transition-standard",
                itemIndex <= index ? "text-foreground" : "text-muted-foreground",
              )}
              key={item}
            >
              {t(LABEL_KEYS[item])}
            </span>
          ))}
        </div>
        <span className="text-muted-foreground">
          {t("step_of", { current: index + 1, total: STEPS.length })}
        </span>
      </div>
      <div className="flex gap-1.5">
        {STEPS.map((item, itemIndex) => (
          <span
            className={cn(
              "h-1 flex-1 rounded-full transition-standard",
              itemIndex <= index ? "bg-foreground" : "bg-border",
            )}
            key={item}
          />
        ))}
      </div>
    </div>
  );
}
