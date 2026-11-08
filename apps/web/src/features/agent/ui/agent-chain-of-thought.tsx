"use client";

import { type ReactNode, useState } from "react";
import type { ReasoningUIPart } from "ai";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";

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
import { AgentReasoning } from "./agent-reasoning";
import { type AgentToolPart, ToolCallIndicator } from "./tool-call-indicator";

export type ActivityStep =
  | { key: string; kind: "reasoning"; part: ReasoningUIPart }
  | { key: string; kind: "tool"; part: AgentToolPart };

type Props = {
  addToolApprovalResponse: (options: { approved: boolean; id: string; reason?: string }) => void;
  isAnswering: boolean;
  isStreaming: boolean;
  renderReasoning: (part: ReasoningUIPart) => ReactNode;
  steps: ActivityStep[];
  toolLabelKeys: Record<string, AgentToolLabelKey>;
};

export function AgentChainOfThought({
  addToolApprovalResponse,
  isAnswering,
  isStreaming,
  renderReasoning,
  steps,
  toolLabelKeys,
}: Readonly<Props>) {
  const t = useTranslations("Agent");
  const [open, setOpen] = useState<boolean>();

  const running = isStreaming && !isAnswering;
  const failed = steps.filter(
    (step) => step.kind === "tool" && step.part.state === "output-error",
  ).length;
  const status = running ? "running" : failed > 0 ? "error" : undefined;

  return (
    <Trace>
      <TraceCollapsible
        onOpenChange={setOpen}
        open={open ?? running}
      >
        <TraceCollapsibleTrigger>
          <TraceLine status={status}>
            <TraceIcon>
              {running ? (
                <LoaderCircle className="animate-spin" />
              ) : failed > 0 ? (
                <CircleAlert />
              ) : (
                <CircleCheck />
              )}
            </TraceIcon>
            <TraceTitle>
              {running ? t("thinking") : t("thought_steps", { count: steps.length })}
              {failed > 0 ? ` · ${t("failed_count", { count: failed })}` : ""}
            </TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <Trace>
            {steps.map((step) =>
              step.kind === "reasoning" ? (
                <AgentReasoning
                  isStreaming={step.part.state === "streaming"}
                  key={step.key}
                >
                  {renderReasoning(step.part)}
                </AgentReasoning>
              ) : (
                <ToolCallIndicator
                  addToolApprovalResponse={addToolApprovalResponse}
                  isStreaming={isStreaming}
                  key={step.key}
                  part={step.part}
                  toolLabelKeys={toolLabelKeys}
                />
              ),
            )}
          </Trace>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
}
