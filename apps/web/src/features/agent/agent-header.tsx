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
    <div className="bg-card flex h-12 w-full items-center justify-between border-b px-4 py-6">
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium">Dxnx_ Agent</p>
            <AppBadge variant="outline" className="text-warning">
              BETA
            </AppBadge>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <AppButton size="icon" variant="ghost" onClick={() => setExpanded(!expanded)}>
          {expanded ? <Minimize2 /> : <Maximize2 />}
        </AppButton>

        <AppButton size="icon" variant="ghost" onClick={closeAgent}>
          <X />
        </AppButton>
      </div>
    </div>
  );
}
