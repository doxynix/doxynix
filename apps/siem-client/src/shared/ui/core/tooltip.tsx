import React from "react";
import * as TooltipPrimitives from "@radix-ui/react-tooltip";

import { cx } from "../../lib/utils";

interface TooltipProps
  extends Omit<TooltipPrimitives.TooltipContentProps, "content" | "onClick">,
    Pick<
      TooltipPrimitives.TooltipProps,
      "open" | "defaultOpen" | "onOpenChange" | "delayDuration"
    > {
  content: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  side?: "bottom" | "left" | "top" | "right";
  showArrow?: boolean;
}

const Tooltip = React.forwardRef<React.ElementRef<typeof TooltipPrimitives.Content>, TooltipProps>(
  (
    {
      children,
      className,
      content,
      delayDuration,
      defaultOpen,
      open,
      onClick,
      onOpenChange,
      showArrow = true,
      side,
      sideOffset = 10,
      asChild,
      ...props
    }: TooltipProps,
    forwardedRef,
  ) => {
    return (
      <TooltipPrimitives.Provider delayDuration={150}>
        <TooltipPrimitives.Root
          defaultOpen={defaultOpen}
          delayDuration={delayDuration}
          onOpenChange={onOpenChange}
          open={open}
          tremor-id="tremor-raw"
        >
          <TooltipPrimitives.Trigger asChild={asChild} onClick={onClick}>
            {children}
          </TooltipPrimitives.Trigger>
          <TooltipPrimitives.Portal>
            <TooltipPrimitives.Content
              align="center"
              className={cx(
                // base
                "max-w-60 select-none rounded-md px-2.5 py-1.5 text-sm leading-5 shadow-md",
                // text color
                "text-gray-50 dark:text-gray-900",
                // background color
                "bg-gray-900 dark:bg-gray-50",
                // transition
                "will-change-[transform,opacity]",
                "data-[side=bottom]:animate-slide-down-and-fade data-[side=left]:animate-slide-left-and-fade data-[side=right]:animate-slide-right-and-fade data-[side=top]:animate-slide-up-and-fade data-[state=closed]:animate-hide",
                className,
              )}
              ref={forwardedRef}
              side={side}
              sideOffset={sideOffset}
              {...props}
            >
              {content}
              {showArrow ? (
                <TooltipPrimitives.Arrow
                  aria-hidden="true"
                  className="border-none fill-gray-900 dark:fill-gray-50"
                  height={7}
                  width={12}
                />
              ) : null}
            </TooltipPrimitives.Content>
          </TooltipPrimitives.Portal>
        </TooltipPrimitives.Root>
      </TooltipPrimitives.Provider>
    );
  },
);

Tooltip.displayName = "Tooltip";

export { Tooltip, type TooltipProps };
