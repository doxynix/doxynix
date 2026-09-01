import type { ComponentPropsWithoutRef, CSSProperties, FC } from "react";

import { cn } from "@/shared/lib/cn";

interface AnimatedShinyTextProps extends ComponentPropsWithoutRef<"span"> {
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
        "mx-auto max-w-md text-foreground/65",

        // Shine effect
        "animate-shiny-text bg-position-[0_0] bg-size-[var(--shiny-width)_100%] bg-clip-text bg-no-repeat [transition:background-position_1s_cubic-bezier(.6,.6,0,1)_infinite]",

        // Shine gradient
        "bg-linear-to-r from-transparent via-50% via-foreground/80 to-transparent",

        className,
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
