import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

interface MarqueeProps extends ComponentPropsWithoutRef<"div"> {
  children: ReactNode;
  className?: string;
  pauseOnHover?: boolean;
  repeat?: number;
  reverse?: boolean;
  vertical?: boolean;
}

export function Marquee({
  children,
  className,
  pauseOnHover = false,
  repeat = 4,
  reverse = false,
  vertical = false,
  ...props
}: Readonly<MarqueeProps>) {
  return (
    <div
      {...props}
      className={cn(
        "group flex gap-(--gap) overflow-hidden p-2 [--duration:40s] [--gap:1rem] sm:[--gap:5rem]",
        {
          "flex-col": vertical,
          "flex-row": !vertical,
        },
        className,
      )}
    >
      {Array(repeat)
        .fill(0)
        .map((_, i) => (
          <div
            className={cn("flex shrink-0 justify-around gap-(--gap)", {
              "animate-marquee flex-row": !vertical,
              "animate-marquee-vertical flex-col": vertical,
              "direction-[reverse]": reverse,
              "group-hover:paused": pauseOnHover,
            })}
            key={i}
          >
            {children}
          </div>
        ))}
    </div>
  );
}
