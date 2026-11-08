"use client";

import { type ReactNode, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/shared/ui/core/trace";

type Props = {
  children: ReactNode;
  isStreaming: boolean;
};

export function AgentReasoning({ children, isStreaming }: Readonly<Props>) {
  const t = useTranslations("Agent");
  const [open, setOpen] = useState<boolean>();

  return (
    <TraceCollapsible
      onOpenChange={setOpen}
      open={open ?? isStreaming}
    >
      <TraceCollapsibleTrigger>
        <TraceLine status={isStreaming ? "running" : undefined}>
          <TraceIcon>
            {isStreaming ? <LoaderCircle className="animate-spin" /> : <Check />}
          </TraceIcon>
          <TraceTitle>{isStreaming ? t("thinking") : t("thought")}</TraceTitle>
        </TraceLine>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent className="whitespace-pre-wrap">{children}</TraceCollapsibleContent>
    </TraceCollapsible>
  );
}
