import { ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/core/tooltip";

type Props = {
  children: ReactNode;
  content: ReactNode;
  delay?: number;
  open?: boolean;
  hidden?: boolean;
  side?: "top" | "right" | "left" | "bottom" | undefined;
  disableHoverableContent?: boolean;
};

export function AppTooltip({
  children,
  content,
  delay = 300,
  open,
  hidden,
  side,
  disableHoverableContent = true,
}: Props) {
  return (
    <Tooltip disableHoverableContent={disableHoverableContent} delayDuration={delay} open={open}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="hidden [@media(hover:hover)]:block" hidden={hidden} side={side}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
