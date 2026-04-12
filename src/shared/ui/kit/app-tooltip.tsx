"use client";

import React, { type ReactNode } from "react";

import { useCanHover } from "@/shared/hooks/use-can-hover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/core/tooltip";

type Props = {
  align?: "center" | "end" | "start";
  children: ReactNode;
  className?: string;
  content: ReactNode;
  delay?: number;
  disableHoverableContent?: boolean;
  hidden?: boolean;
  open?: boolean;
  side?: "bottom" | "left" | "right" | "top";
};

export function AppTooltip({
  align = "center",
  children,
  className,
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
      <TooltipContent align={align} hidden={hidden} side={side} className={className}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
