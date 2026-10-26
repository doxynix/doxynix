"use client";

import { useTranslations } from "next-intl";

const BARS = [
  { labelKey: "preview_complexity", tone: "bg-warning", value: 62 },
  { labelKey: "preview_tech_debt", tone: "bg-destructive", value: 38 },
  { labelKey: "preview_docs_coverage", tone: "bg-success", value: 84 },
] as const;

export function MetricsPreview() {
  const t = useTranslations("Welcome");

  return (
    <div className="flex h-full flex-col gap-4 rounded-xl border bg-background/60 p-5">
      <div className="flex items-center gap-4">
        <div className="relative flex size-20 items-center justify-center rounded-full border-8 border-success/20">
          <span className="font-bold text-xl">84</span>
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-sm">{t("preview_overall_health")}</p>
          <p className="text-muted-foreground text-xs">
            {t("preview_bus_factor", { count: 3, files: 142 })}
          </p>
          <div className="mt-1 flex gap-1">
            <span className="rounded-full border bg-card px-2 py-0.5 text-[10px]">
              {t("preview_risks", { count: 24 })}
            </span>
            <span className="rounded-full border bg-card px-2 py-0.5 text-[10px]">
              {t("preview_hotspots", { count: 12 })}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {BARS.map((bar) => (
          <div
            className="flex flex-col gap-1"
            key={bar.labelKey}
          >
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">{t(bar.labelKey)}</span>
              <span>{bar.value}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-border">
              <div
                className={`h-full rounded-full ${bar.tone}`}
                style={{ width: `${bar.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
