"use client";

import type { ComponentType } from "react";
import type { OnboardingIntent } from "@doxynix/shared";
import { BookOpen, ChartNoAxesColumn, GitGraph } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/shared/lib/cn";

type IntentOption = {
  desc: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  value: OnboardingIntent;
};

type Props = {
  disabled?: boolean;
  onChange: (intent: OnboardingIntent) => void;
  value: OnboardingIntent;
};

export function IntentPicker({ disabled = false, onChange, value }: Readonly<Props>) {
  const t = useTranslations("Welcome");

  const options: readonly IntentOption[] = [
    {
      desc: t("intent_architecture_desc"),
      icon: GitGraph,
      title: t("intent_architecture_title"),
      value: "ARCHITECTURE",
    },
    {
      desc: t("intent_documentation_desc"),
      icon: BookOpen,
      title: t("intent_documentation_title"),
      value: "DOCUMENTATION",
    },
    {
      desc: t("intent_risks_desc"),
      icon: ChartNoAxesColumn,
      title: t("intent_risks_title"),
      value: "RISKS",
    },
  ];

  return (
    <fieldset
      className="flex flex-col gap-3"
      disabled={disabled}
    >
      <legend className="mb-3 font-medium text-sm">{t("intent_title")}</legend>
      <div className="grid gap-3 min-[1200px]:grid-cols-3">
        {options.map((option) => {
          const checked = value === option.value;
          const id = `onboarding-intent-${option.value.toLowerCase()}`;

          return (
            <label
              className={cn(
                "flex min-w-0 cursor-pointer flex-col gap-2 rounded-xl border p-3 transition-standard",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50",
                checked
                  ? "border-border-strong bg-surface-selected"
                  : "border-border bg-card hover:bg-accent/50",
                disabled && "cursor-not-allowed opacity-50",
              )}
              htmlFor={id}
              key={option.value}
            >
              <input
                checked={checked}
                className="sr-only"
                disabled={disabled}
                id={id}
                name="onboarding-intent"
                onChange={() => onChange(option.value)}
                type="radio"
                value={option.value}
              />
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg border",
                  checked
                    ? "border-border-strong bg-primary text-primary-foreground"
                    : "border-border bg-surface-hover text-muted-foreground",
                )}
              >
                <option.icon className="size-4" />
              </span>
              <span className="break-words font-semibold text-sm">{option.title}</span>
              <span className="break-words text-muted-foreground text-xs">{option.desc}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
