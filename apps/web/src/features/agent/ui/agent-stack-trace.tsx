"use client";

import { FileCode, Layers, Terminal } from "lucide-react";
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

type Frame = {
  file?: string;
  internal: boolean;
  line: string;
  lineNumber?: string;
  name?: string;
};

const FRAME_PATTERN = /^at (.+?) \((.+):(\d+):(\d+)\)$/;
const BARE_FRAME_PATTERN = /^at (.+)$/;

export function hasStackTrace(text: string): boolean {
  return text.split("\n").some((line) => line.trim().startsWith("at "));
}

function parseFrame(line: string): Frame {
  const trimmed = line.trim();
  const match = FRAME_PATTERN.exec(trimmed);
  const bare = BARE_FRAME_PATTERN.exec(trimmed);

  return {
    file: match?.[2],
    internal: trimmed.includes("node_modules") || trimmed.includes("node:"),
    line: trimmed,
    lineNumber: match?.[3],
    name: match?.[1] ?? bare?.[1],
  };
}

export function AgentStackTrace({ stack }: Readonly<{ stack: string }>) {
  const t = useTranslations("Agent");
  const [error, ...lines] = stack
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const frames = lines.map(parseFrame);
  const appFrames = frames.filter((frame) => !frame.internal);
  const internalFrames = frames.filter((frame) => frame.internal);

  return (
    <TraceCollapsible defaultOpen>
      <TraceCollapsibleTrigger>
        <TraceLine status="error">
          <TraceIcon>
            <Terminal className="size-3.5 text-destructive" />
          </TraceIcon>
          <TraceTitle className="max-w-[420px] truncate text-destructive text-xs">
            {t("stack_trace_failed", { error: error ?? "" })}
          </TraceTitle>
        </TraceLine>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent className="flex flex-col gap-2">
        {error != null && error !== "" && (
          <p className="font-mono text-destructive text-xs">{error}</p>
        )}

        {appFrames.length > 0 && (
          <Trace>
            {appFrames.map((frame) => (
              <TraceLine key={frame.line}>
                <TraceIcon>
                  <FileCode />
                </TraceIcon>
                <TraceTitle>
                  {frame.name ?? frame.line}
                  {frame.file != null && frame.lineNumber != null
                    ? ` · ${frame.file}:${frame.lineNumber}`
                    : ""}
                </TraceTitle>
              </TraceLine>
            ))}
          </Trace>
        )}

        {internalFrames.length > 0 && (
          <TraceCollapsible>
            <TraceCollapsibleTrigger>
              <TraceLine>
                <TraceIcon>
                  <Layers />
                </TraceIcon>
                <TraceTitle>
                  {t("stack_trace_framework_frames", { count: internalFrames.length })}
                </TraceTitle>
              </TraceLine>
            </TraceCollapsibleTrigger>
            <TraceCollapsibleContent>
              <ol className="flex flex-col gap-1 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
                {internalFrames.map((frame) => (
                  <li
                    className="whitespace-nowrap"
                    key={frame.line}
                  >
                    {frame.line}
                  </li>
                ))}
              </ol>
            </TraceCollapsibleContent>
          </TraceCollapsible>
        )}
      </TraceCollapsibleContent>
    </TraceCollapsible>
  );
}
