"use client";

import { type ComponentPropsWithoutRef, type ComponentRef, forwardRef } from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "@/shared/lib/cn";

interface ScrollAreaProps extends ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> {
  viewportClassName?: string;
}

const ScrollArea = forwardRef<ComponentRef<typeof ScrollAreaPrimitive.Root>, ScrollAreaProps>(
  ({ children, className, viewportClassName, ...props }, ref) => (
    <ScrollAreaPrimitive.Root
      className={cn("relative overflow-hidden", className)}
      ref={ref}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        className={cn("h-full w-full rounded-[inherit]", viewportClassName)}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  ),
);
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = forwardRef<
  ComponentRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    className={cn(
      "flex touch-none select-none transition-colors",
      "data-[state=visible]:fade-in-0 data-[state=visible]:animate-in data-[state=visible]:duration-200",
      "data-[state=hidden]:fade-out-0 data-[state=hidden]:animate-out data-[state=hidden]:duration-200",
      orientation === "vertical" && "h-full w-1.5 border-l border-l-transparent p-px",
      orientation === "horizontal" && "h-1.5 flex-col border-t border-t-transparent p-px",
      className,
    )}
    orientation={orientation}
    ref={ref}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-accent-foreground" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };
