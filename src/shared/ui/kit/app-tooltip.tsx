"use client";

import React, { type ReactNode } from "react";

import { useCanHover } from "@/shared/hooks/use-can-hover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/core/tooltip";

type Props = {
  align?: "start" | "center" | "end";
  children: ReactNode;
  content: ReactNode;
  delay?: number;
  disableHoverableContent?: boolean;
  hidden?: boolean;
  open?: boolean;
  side?: "top" | "right" | "left" | "bottom";
};

export function AppTooltip({
  align = "center",
  children,
  content,
  delay = 400,
  disableHoverableContent = true,
  hidden,
  open: controlledOpen,
  side = "top",
}: Readonly<Props>) {
  const canHover = useCanHover();

  if (!canHover || !content) {
    return <>{children}</>;
  }

  return (
    <Tooltip
      delayDuration={delay}
      disableHoverableContent={disableHoverableContent}
      open={controlledOpen}
    >
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent align={align} hidden={hidden} side={side}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
