"use client";

import { Sparkles } from "lucide-react";

import { AppButton } from "@/shared/ui/core/button";

import { useAgentIsOpen, useAgentOpen } from "@/features/agent/model/use-agent.store";

export function AgentButton() {
  const openAgent = useAgentOpen();
  const isOpen = useAgentIsOpen();

  return (
    <AppButton disabled={isOpen} onClick={openAgent} size="sm" variant="outline">
      <Sparkles />
      Ask Dxnx_
    </AppButton>
  );
}
