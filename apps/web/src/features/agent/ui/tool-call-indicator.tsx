"use client";

import { AlertTriangle, Check, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import { Spinner } from "@/shared/ui/core/spinner";

import type { AgentToolLabelKey } from "../model/agent-config";
import { getDynamicToolContext, getToolBaseLabel, prettifyToolName } from "../model/tool-context";

type Props = {
  addToolApprovalResponse: (options: { approved: boolean; id: string; reason?: string }) => void;
  part: ToolIndicatorPart;
  toolLabelKeys: Record<string, AgentToolLabelKey>;
};

/**
 * Structural view of an AI SDK tool part, kept local on purpose.
 *
 * `ToolUIPart` / `DynamicToolUIPart` from `ai@7.0.116` are the correct nominal
 * types, but neither is usable here:
 *
 * - `ToolUIPart<TOOLS extends UITools = UITools>` is a `ValueOf` over tool names.
 *   Without the exact tool set it collapses to the untyped default, and this
 *   component is consumed from a `useChat` that declares no tool set.
 * - `DynamicToolUIPart` is discriminated by `type: "dynamic-tool"` (12 chars),
 *   while this component strips a 5-character `"tool-"` prefix, so it can never
 *   be the runtime shape here.
 *
 * The `state` values are enumerated from `UIToolInvocation` so that
 * `part.state === "approval-requested"` genuinely narrows `approval` to
 * required. `agent.tsx` carries the compile-time assertion that the SDK's
 * `ToolUIPart` union stays assignable to this type, so the two cannot drift.
 *
 * `args` is optional and, as of `ai@7.0.116`, is never actually present at
 * runtime — the SDK emits the tool input as `part.input`. Reading `input`
 * instead is a behaviour change (it would start rendering the args preview and
 * the dynamic tool context) and is deliberately NOT folded into this typing-only
 * change; it needs its own ticket and test.
 */
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
      <div className="fade-in my-2 w-full animate-in text-left duration-200">
        <div className="flex max-w-[95%] flex-col gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3">
          <div className="flex items-center gap-1.5 font-semibold text-warning text-xs">
            <AlertTriangle className="size-3.5" />
            <span>{t("action_requires_confirmation")}</span>
          </div>
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
        </div>
      </div>
    );
  }

  if (isResponded) {
    const wasApproved = part.approval.approved;
    return (
      <div className="fade-in my-1 w-full animate-in text-left duration-200">
        <AppBadge
          className="flex items-center gap-2 text-muted-foreground text-xs"
          variant="outline"
        >
          {wasApproved ? (
            <>
              <span className="font-bold text-success text-xs">
                <Check className="text-success" />
              </span>
              <span className="max-w-[320px] truncate text-foreground">
                {`${fullLabel} (${t("approved")})`}
              </span>
            </>
          ) : (
            <>
              <span className="font-bold text-destructive text-xs">
                <X className="text-destructive" />
              </span>
              <span className="max-w-[320px] truncate text-foreground">
                {`${fullLabel} (${t("denied")})`}
              </span>
            </>
          )}
        </AppBadge>
      </div>
    );
  }

  if (isCompleted) {
    const isError = part.state === "output-error";
    return (
      <div className="fade-in my-1 w-full animate-in text-left duration-200">
        <AppBadge
          className="flex items-center gap-2 text-muted-foreground text-xs"
          variant="outline"
        >
          {isError ? <X className="text-destructive" /> : <Check className="text-success" />}
          <span className="max-w-[320px] truncate text-foreground">
            {`${fullLabel} ${isError ? `(${tCommon("failed")})` : `(${t("completed")})`}`}
          </span>
        </AppBadge>
      </div>
    );
  }

  return (
    <div className="fade-in my-1 w-full animate-in text-left duration-200">
      <AppBadge
        className="flex items-center gap-2 text-muted-foreground text-xs"
        variant="outline"
      >
        <Spinner />
        <span className="max-w-[320px] truncate text-foreground">{fullLabel}</span>
      </AppBadge>
    </div>
  );
}
