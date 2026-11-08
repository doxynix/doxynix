"use client";

import type { DynamicToolUIPart, ToolUIPart } from "ai";
import { Check, CircleSlash, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { useShikiHtml } from "@/shared/lib/hooks/use-shiki-highlight";
import { CodeBlock, CodeBlockContent, CodeBlockHtml } from "@/shared/ui/core/code-block";
import { Spinner } from "@/shared/ui/core/spinner";
import {
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/shared/ui/core/trace";

import type { AgentToolLabelKey } from "../model/agent-config";
import { getDynamicToolContext, getToolBaseLabel, prettifyToolName } from "../model/tool-context";
import { AgentConfirmation } from "./agent-confirmation";
import { AgentStackTrace, hasStackTrace } from "./agent-stack-trace";

type Props = {
  addToolApprovalResponse: (options: { approved: boolean; id: string; reason?: string }) => void;
  isStreaming: boolean;
  part: AgentToolPart;
  toolLabelKeys: Record<string, AgentToolLabelKey>;
};

export type AgentToolPart = DynamicToolUIPart | ToolUIPart;

const MAX_OUTPUT_CHARS = 5000;

function getToolName(part: AgentToolPart): string {
  return part.type === "dynamic-tool" ? part.toolName : part.type.slice(5);
}

function formatOutput(value: unknown): string {
  if (value == null) {
    return "";
  }

  try {
    const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);

    return text.length > MAX_OUTPUT_CHARS ? `${text.slice(0, MAX_OUTPUT_CHARS)}\n…` : text;
  } catch {
    return String(value);
  }
}

export function ToolCallIndicator({
  addToolApprovalResponse,
  isStreaming,
  part,
  toolLabelKeys,
}: Readonly<Props>) {
  const t = useTranslations("Agent");
  const tCommon = useTranslations("Common");
  const toolName = getToolName(part);

  const resolvedToolLabels: Record<string, string> = {};
  for (const [tool, key] of Object.entries(toolLabelKeys)) {
    resolvedToolLabels[tool] = t(key);
  }

  const baseLabel =
    getToolBaseLabel(toolName, resolvedToolLabels) ??
    t("tool_executing", { tool: prettifyToolName(toolName) });

  const dynamicContext = getDynamicToolContext(toolName, part.input);
  const fullLabel = dynamicContext != null ? `${baseLabel}: ${dynamicContext}` : baseLabel;

  const outputText =
    part.state === "output-available"
      ? formatOutput(part.output)
      : part.state === "output-error"
        ? part.errorText
        : "";
  const outputLang =
    part.state === "output-available" && typeof part.output !== "string" ? "json" : "text";
  const highlightedOutput = useShikiHtml(outputText, outputLang);

  if (part.state === "approval-requested") {
    return (
      <AgentConfirmation
        approvalId={part.approval.id}
        args={part.input}
        label={fullLabel}
        onRespond={addToolApprovalResponse}
      />
    );
  }

  const isDenied =
    part.state === "output-denied" ||
    (part.state === "approval-responded" && !part.approval.approved);

  if (isDenied) {
    return (
      <TraceLine>
        <TraceIcon>
          <CircleSlash className="size-3.5 text-muted-foreground" />
        </TraceIcon>
        <TraceTitle className="max-w-[320px] truncate text-foreground text-xs">
          {`${fullLabel} (${t("denied")})`}
        </TraceTitle>
      </TraceLine>
    );
  }

  if (part.state === "output-available" || part.state === "output-error") {
    if (part.state === "output-error" && hasStackTrace(part.errorText)) {
      return <AgentStackTrace stack={part.errorText} />;
    }

    const failed = part.state === "output-error";

    return (
      <TraceCollapsible defaultOpen={failed}>
        <TraceCollapsibleTrigger>
          <TraceLine status={failed ? "error" : undefined}>
            <TraceIcon>
              {failed ? (
                <X className="size-3.5 text-destructive" />
              ) : (
                <Check className="size-3.5" />
              )}
            </TraceIcon>
            <TraceTitle className="max-w-[320px] truncate text-foreground text-xs">
              {`${fullLabel} ${failed ? `(${tCommon("failed")})` : ""}`.trim()}
            </TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <CodeBlock
            size="sm"
            variant={failed ? "destructive" : "default"}
          >
            {highlightedOutput == null ? (
              <CodeBlockContent
                className="max-h-64"
                wrap
              >
                {outputText === "" ? t("tool_no_output") : outputText}
              </CodeBlockContent>
            ) : (
              <CodeBlockHtml
                className="max-h-64"
                html={highlightedOutput}
                wrap
              />
            )}
          </CodeBlock>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    );
  }

  // Every state that reaches this point is a call that has not produced output yet.
  const isRunning = isStreaming;

  return (
    <TraceLine status={isRunning ? "running" : "pending"}>
      <TraceIcon>{isRunning ? <Spinner className="size-3.5" /> : null}</TraceIcon>
      <TraceTitle className="max-w-[320px] truncate text-foreground text-xs">
        {fullLabel}
      </TraceTitle>
    </TraceLine>
  );
}
