"use client";

import type { ComponentProps } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/shared/lib/cn";

function TooltipProvider({
  delayDuration = 200,
  ...props
}: Readonly<ComponentProps<typeof TooltipPrimitive.Provider>>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip({ ...props }: Readonly<ComponentProps<typeof TooltipPrimitive.Root>>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({ ...props }: ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  children,
  className,
  sideOffset = 8,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        className={cn(
          "z-50 overflow-hidden rounded-lg border border-border bg-popover px-3 py-1.5 font-medium text-popover-foreground text-xs",
          "fade-in-0 zoom-in-98 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 animate-in data-[state=closed]:animate-out",
          "data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1",
          className,
        )}
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        {...props}
      >
        {children}
        {/* <TooltipPrimitive.Arrow className="fill-popover stroke-border" strokeWidth={1} /> */}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
