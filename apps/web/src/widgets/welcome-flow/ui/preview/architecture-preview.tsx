"use client";

import { useTranslations } from "next-intl";

import { AppMermaid } from "@/shared/ui/core/mermaid";

// Real dependency direction of this app, kept to three ranks so the preview stays legible.
const CHART = `flowchart TB
  features["features"] --> entities["entities"]
  entities --> shared["shared"]
  features -->|tRPC| api["api"]
  api --> db[("postgres")]`;

const CONFIG = { fontSize: 13 } as const;

export function ArchitecturePreview() {
  const t = useTranslations("Welcome");

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden rounded-xl border bg-background/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
          {t("preview_architecture")}
        </span>
        <span className="rounded-full border bg-card px-2 py-0.5 text-[10px] text-muted-foreground">
          {t("preview_modules", { count: 142, layers: 6 })}
        </span>
      </div>

      <AppMermaid
        chart={CHART}
        className="min-h-0 flex-1 rounded-lg border bg-card/40 p-2 [&_svg]:max-h-full"
        config={CONFIG}
        debounceTime={0}
      />

      <div className="flex items-center justify-end">
        <span className="rounded-full border bg-card px-2 py-0.5 text-[10px] text-muted-foreground">
          {t("preview_health", { score: 84 })}
        </span>
      </div>
    </div>
  );
}
