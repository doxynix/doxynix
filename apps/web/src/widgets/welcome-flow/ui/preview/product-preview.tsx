"use client";

import type { OnboardingIntent } from "@doxynix/shared";
import { BookOpen, ChartNoAxesColumn, GitGraph } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";

import { cn } from "@/shared/lib/cn";
import { useAppearancePreferences } from "@/shared/lib/hooks/use-appearance-preferences";

import { ArchitecturePreview } from "./architecture-preview";
import { DocsPreview } from "./docs-preview";
import { MetricsPreview } from "./metrics-preview";

type Props = {
  intent: OnboardingIntent;
};

const TABS = [
  { icon: GitGraph, intent: "ARCHITECTURE", labelKey: "preview_architecture" },
  { icon: BookOpen, intent: "DOCUMENTATION", labelKey: "preview_docs" },
  { icon: ChartNoAxesColumn, intent: "RISKS", labelKey: "preview_metrics" },
] as const;

export function ProductPreview({ intent }: Readonly<Props>) {
  const t = useTranslations("Welcome");
  const { preferences } = useAppearancePreferences();
  const reduceMotion = useReducedMotion() || preferences.reduceMotion;

  return (
    <div className="relative min-w-0 overflow-hidden rounded-3xl border bg-card/70 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-destructive/70" />
          <span className="size-2.5 rounded-full bg-warning/70" />
          <span className="size-2.5 rounded-full bg-success/70" />
        </div>
        <div className="flex min-w-0 items-center gap-1 overflow-hidden rounded-full border bg-background/70 p-1">
          {TABS.map((tab) => (
            <span
              className={cn(
                "flex min-w-0 items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-standard sm:px-2.5",
                tab.intent === intent
                  ? "bg-surface-selected text-foreground"
                  : "text-muted-foreground",
              )}
              key={tab.intent}
            >
              <tab.icon className="size-3 shrink-0" />
              <span className="hidden truncate sm:inline">{t(tab.labelKey)}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="relative h-[clamp(260px,42vh,420px)] p-4">
        <AnimatePresence mode="wait">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="h-full"
            exit={reduceMotion ? undefined : { opacity: 0, y: 8 }}
            initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
            key={intent}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {intent === "ARCHITECTURE" && <ArchitecturePreview />}
            {intent === "DOCUMENTATION" && <DocsPreview />}
            {intent === "RISKS" && <MetricsPreview />}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="pointer-events-none absolute right-4 bottom-3 rounded-full border bg-background/80 px-2.5 py-1 text-[10px] text-muted-foreground">
        {t("preview_label")}
      </div>
    </div>
  );
}
