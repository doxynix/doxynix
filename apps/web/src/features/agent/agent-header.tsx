"use client";

import { Maximize2, Minimize2, X } from "lucide-react";

import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";

import { useAgentClose } from "./model/use-agent.store";

type Props = {
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
};

export function AgentHeader({ expanded, setExpanded }: Readonly<Props>) {
  const closeAgent = useAgentClose();

  return (
    <div className="flex h-12 w-full items-center justify-between border-b bg-card px-4 py-6">
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="font-medium text-sm">Dxnx_ Agent</p>
            <AppBadge className="text-warning" variant="outline">
              BETA
            </AppBadge>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <AppButton onClick={() => setExpanded(!expanded)} size="icon" variant="ghost">
          {expanded ? <Minimize2 /> : <Maximize2 />}
        </AppButton>

        <AppButton onClick={closeAgent} size="icon" variant="ghost">
          <X />
        </AppButton>
      </div>
    </div>
  );
}
