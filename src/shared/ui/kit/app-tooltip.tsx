"use client";

import React, { ReactNode, useState } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/core/tooltip";

type Props = {
  children: ReactNode;
  content: ReactNode;
  delay?: number;
  open?: boolean;
  hidden?: boolean;
  side?: "top" | "right" | "left" | "bottom";
  disableHoverableContent?: boolean;
};

export function AppTooltip({
  children,
  content,
  delay = 300,
  open: controlledOpen,
  hidden,
  side,
  disableHoverableContent = true,
}: Props) {
  const [canHover, setCanHover] = useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia("(hover: hover)");
    setCanHover(mql.matches);

    const handler = (e: MediaQueryListEvent) => setCanHover(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  if (!canHover) {
    return <>{children}</>;
  }

  return (
    <Tooltip
      disableHoverableContent={disableHoverableContent}
      delayDuration={delay}
      open={controlledOpen}
    >
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent hidden={hidden} side={side}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
