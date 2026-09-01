"use client";

import type { ComponentProps } from "react";
import { GripVertical } from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";

import { cn } from "@/shared/lib/cn";

const ResizablePanelGroup = ({ className, ...props }: ComponentProps<typeof Group>) => (
  <Group
    className={cn("flex h-full w-full data-[orientation=vertical]:flex-col", className)}
    data-slot="resizable-panel-group"
    {...props}
  />
);

const ResizablePanel = Panel;

const ResizableHandle = ({
  className,
  withHandle,
  ...props
}: ComponentProps<typeof Separator> & {
  withHandle?: boolean;
}) => (
  <Separator
    className={cn(
      "relative z-50 flex w-px items-center justify-center bg-border",
      "after:absolute after:inset-y-0 after:left-1/2 after:-translate-x-1/2",
      "focus-visible:bg-ring focus-visible:outline-hidden focus-visible:ring-2",
      "data-[orientation=vertical]:h-px data-[orientation=vertical]:w-full",
      "data-[orientation=vertical]:after:left-0 data-[orientation=vertical]:after:h-10 data-[orientation=vertical]:after:w-full data-[orientation=vertical]:after:-translate-y-1/2",
      "cursor-col-resize data-[orientation=vertical]:cursor-row-resize",
      className,
    )}
    data-slot="resizable-handle"
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
        <GripVertical className="size-2.5 text-muted-foreground" />
      </div>
    )}
  </Separator>
);

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
