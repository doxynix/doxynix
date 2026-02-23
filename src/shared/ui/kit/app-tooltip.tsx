"use client";

import React, { useState, type ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/core/tooltip";

type Props = {
  children: ReactNode;
  content: ReactNode;
  delay?: number;
  disableHoverableContent?: boolean;
  hidden?: boolean;
  open?: boolean;
  side?: "top" | "right" | "left" | "bottom";
};

export function AppTooltip({
  children,
  content,
  delay = 300,
  disableHoverableContent = true,
  hidden,
  open: controlledOpen,
  side,
}: Readonly<Props>) {
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
      delayDuration={delay}
      disableHoverableContent={disableHoverableContent}
      open={controlledOpen}
    >
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent hidden={hidden} side={side}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
