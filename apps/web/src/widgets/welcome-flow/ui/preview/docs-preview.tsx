"use client";

import { useTranslations } from "next-intl";

export function DocsPreview() {
  const t = useTranslations("Welcome");

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden rounded-xl border bg-background/60 p-4">
      <div className="flex items-center justify-between">
        <div className="h-4 w-2/5 rounded-full bg-foreground" />
        <span className="rounded-full border bg-card px-2 py-0.5 text-[10px] text-muted-foreground">
          {t("preview_generated")}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="h-2 w-[88%] rounded-full bg-border" />
        <div className="h-2 w-[76%] rounded-full bg-border" />
        <div className="h-2 w-[92%] rounded-full bg-border" />
      </div>

      <div className="mt-1 rounded-lg border bg-card p-3 font-mono text-[10px] leading-5">
        <div>
          <span className="text-brand-ai">import</span>{" "}
          <span className="text-foreground">{"{ auth }"}</span>{" "}
          <span className="text-brand-ai">from</span> <span className="text-success">"./auth"</span>
        </div>
        <div>
          <span className="text-brand-ai">export async function</span>{" "}
          <span className="text-warning">getSession</span>() {"{"}
        </div>
        <div className="pl-4">
          <span className="text-brand-ai">return</span> auth.
          <span className="text-warning">getSession</span>();
        </div>
        <div>{"}"}</div>
      </div>

      <div className="mt-auto flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="rounded-full border bg-card px-2 py-0.5">README</span>
        <span className="rounded-full border bg-card px-2 py-0.5">API</span>
        <span className="rounded-full border bg-card px-2 py-0.5">{t("preview_architecture")}</span>
      </div>
    </div>
  );
}
