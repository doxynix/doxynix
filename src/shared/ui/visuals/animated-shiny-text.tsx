import type { ComponentPropsWithoutRef, CSSProperties, FC } from "react";

import { cn } from "@/shared/lib/cn";

export interface AnimatedShinyTextProps extends ComponentPropsWithoutRef<"span"> {
  shimmerWidth?: number;
}

export const AnimatedShinyText: FC<AnimatedShinyTextProps> = ({
  children,
  className,
  shimmerWidth = 100,
  ...props
}) => {
  return (
    <span
      className={cn(
        "text-foreground/65 mx-auto max-w-md",

        // Shine effect
        "animate-shiny-text bg-size-[var(--shiny-width)_100%] bg-clip-text bg-position-[0_0] bg-no-repeat [transition:background-position_1s_cubic-bezier(.6,.6,0,1)_infinite]",

        // Shine gradient
        "via-foreground/80 bg-linear-to-r from-transparent via-50% to-transparent",

        className
      )}
      style={
        {
          "--shiny-width": `${shimmerWidth}px`,
        } as CSSProperties
      }
      {...props}
    >
      {children}
    </span>
  );
};
