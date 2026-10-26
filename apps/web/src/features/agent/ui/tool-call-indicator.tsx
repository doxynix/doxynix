"use client";

import { AlertTriangle, Check, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { AppButton } from "@/shared/ui/core/button";
import { Spinner } from "@/shared/ui/core/spinner";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/shared/ui/core/trace";

import type { AgentToolLabelKey } from "../model/agent-config";
import { getDynamicToolContext, getToolBaseLabel, prettifyToolName } from "../model/tool-context";

type Props = {
  addToolApprovalResponse: (options: { approved: boolean; id: string; reason?: string }) => void;
  part: ToolIndicatorPart;
  toolLabelKeys: Record<string, AgentToolLabelKey>;
};

export type ToolIndicatorPart = { args?: unknown } & (
  | { approval: { id: string }; state: "approval-requested"; type: `tool-${string}` }
  | {
      approval: { approved: boolean; id: string };
      state: "approval-responded";
      type: `tool-${string}`;
    }
  | {
      approval?: { approved?: boolean; id: string };
      state:
        | "input-available"
        | "input-streaming"
        | "output-available"
        | "output-denied"
        | "output-error";
      type: `tool-${string}`;
    }
);

export function ToolCallIndicator({
  addToolApprovalResponse,
  part,
  toolLabelKeys,
}: Readonly<Props>) {
  const t = useTranslations("Agent");
  const tCommon = useTranslations("Common");
  const toolName = part.type.slice(5);

  const resolvedToolLabels: Record<string, string> = {};
  for (const [tool, key] of Object.entries(toolLabelKeys)) {
    resolvedToolLabels[tool] = t(key);
  }

  const baseLabel =
    getToolBaseLabel(toolName, resolvedToolLabels) ??
    t("tool_executing", { tool: prettifyToolName(toolName) });

  const dynamicContext = getDynamicToolContext(toolName, part.args);
  const fullLabel = dynamicContext != null ? `${baseLabel}: ${dynamicContext}` : baseLabel;

  const isApprovalRequested = part.state === "approval-requested";
  const isResponded = part.state === "approval-responded";
  const isCompleted = part.state === "output-available" || part.state === "output-error";

  if (isApprovalRequested) {
    return (
      <Trace className="my-2 w-full animate-in text-left duration-200">
        <TraceCollapsible defaultOpen>
          <TraceCollapsibleTrigger>
            <TraceLine>
              <TraceIcon>
                <AlertTriangle className="size-3.5 text-warning" />
              </TraceIcon>
              <TraceTitle className="font-semibold text-warning text-xs">
                {t("action_requires_confirmation")}
              </TraceTitle>
            </TraceLine>
          </TraceCollapsibleTrigger>
          <TraceCollapsibleContent className="flex flex-col gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3">
            <p className="text-muted-foreground text-xs leading-normal">
              {t("agent_requesting_approval_to")}{" "}
              <strong className="text-foreground">{`${baseLabel}.`}</strong>
            </p>
            {part.args != null && (
              <pre className="no-scrollbar max-h-24 overflow-x-auto rounded-lg border bg-background p-2 font-mono text-[10px] text-muted-foreground">
                {JSON.stringify(part.args, null, 2)}
              </pre>
            )}
            <div className="mt-1 flex items-center gap-2">
              <AppButton
                className="bg-warning text-xs hover:bg-warning/90"
                onClick={() => addToolApprovalResponse({ approved: true, id: part.approval.id })}
                size="sm"
              >
                {t("approve")}
              </AppButton>
              <AppButton
                className="text-xs"
                onClick={() =>
                  addToolApprovalResponse({
                    approved: false,
                    id: part.approval.id,
                    reason: t("denied_by_user"),
                  })
                }
                size="sm"
                variant="ghost"
              >
                {t("deny")}
              </AppButton>
            </div>
          </TraceCollapsibleContent>
        </TraceCollapsible>
      </Trace>
    );
  }

  if (isResponded) {
    const wasApproved = part.approval.approved;
    return (
      <Trace className="my-1 w-full animate-in text-left duration-200">
        <TraceLine>
          <TraceIcon>
            {wasApproved ? (
              <Check className="size-3.5 text-success" />
            ) : (
              <X className="size-3.5 text-destructive" />
            )}
          </TraceIcon>
          <TraceTitle className="max-w-[320px] truncate text-xs text-foreground">
            {`${fullLabel} (${wasApproved ? t("approved") : t("denied")})`}
          </TraceTitle>
        </TraceLine>
      </Trace>
    );
  }

  if (isCompleted) {
    const isError = part.state === "output-error";
    return (
      <Trace className="my-1 w-full animate-in text-left duration-200">
        <TraceLine>
          <TraceIcon>
            {isError ? (
              <X className="size-3.5 text-destructive" />
            ) : (
              <Check className="size-3.5 text-success" />
            )}
          </TraceIcon>
          <TraceTitle className="max-w-[320px] truncate text-xs text-foreground">
            {`${fullLabel} ${isError ? `(${tCommon("failed")})` : `(${t("completed")})`}`}
          </TraceTitle>
        </TraceLine>
      </Trace>
    );
  }

  const isRunning = part.state === "input-streaming";
  return (
    <Trace className="my-1 w-full animate-in text-left duration-200">
      <TraceLine status={isRunning ? "running" : "pending"}>
        <TraceIcon>{isRunning ? <Spinner className="size-3.5" /> : null}</TraceIcon>
        <TraceTitle className="max-w-[320px] truncate text-xs text-foreground">
          {fullLabel}
        </TraceTitle>
      </TraceLine>
    </Trace>
  );
}
