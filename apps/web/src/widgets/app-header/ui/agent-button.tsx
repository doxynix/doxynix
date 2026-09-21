"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { AppButton } from "@/shared/ui/core/button";

import { useAgentIsOpen, useAgentOpen } from "@/features/agent/model/use-agent.store";

export function AgentButton() {
  const tCommon = useTranslations("Common");
  const openAgent = useAgentOpen();
  const isOpen = useAgentIsOpen();

  return (
    <AppButton
      disabled={isOpen}
      onClick={openAgent}
      size="sm"
      variant="outline"
    >
      <Sparkles />
      {tCommon("ask_ai")}
    </AppButton>
  );
}
