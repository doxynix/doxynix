import React, { type ComponentPropsWithoutRef, type CSSProperties } from "react";

import { cn } from "@/shared/lib/utils";
import { Link } from "@/i18n/routing";

import { Button } from "../core/button";

export interface ShimmerButtonProps extends ComponentPropsWithoutRef<"button"> {
  background?: string;
  borderRadius?: string;
  children?: React.ReactNode;
  className?: string;
  href: string;
  shimmerColor?: string;
  shimmerDuration?: string;
  shimmerSize?: string;
}

export const ShimmerButton = React.forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  (
    {
      background = "#111111",
      borderRadius = "100px",
      children,
      className,
      href,
      shimmerColor = "#ffffff",
      shimmerDuration = "3s",
      shimmerSize = "0.05em",
      ...props
    },
    ref
  ) => {
    return (
      <Button
        ref={ref}
        className={cn(
          "group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-white/10 px-6 py-3 whitespace-nowrap text-white [background:var(--bg)]",
          "transform-gpu transition-transform duration-300 ease-in-out active:translate-y-px",
          className
        )}
        style={
          {
            "--bg": background,
            "--cut": shimmerSize,
            "--radius": borderRadius,
            "--shimmer-color": shimmerColor,
            "--speed": shimmerDuration,
            "--spread": "90deg",
          } as CSSProperties
        }
        {...props}
        asChild
      >
        <Link href={href}>
          {/* spark container */}
          <div
            className={cn(
              "-z-30 blur-[2px]",
              "@container-[size] absolute inset-0 overflow-visible"
            )}
          >
            {/* spark */}
            <div className="animate-shimmer-slide absolute inset-0 aspect-[1] h-[100cqh] rounded-none [mask:none]">
              {/* spark before */}
              <div className="animate-spin-around absolute -inset-full w-auto [translate:0_0] rotate-0 [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))]" />
            </div>
          </div>
          {children}

          {/* Highlight */}
          <div
            className={cn(
              "absolute inset-0 size-full",

              // "rounded-2xl px-4 py-1.5 text-sm font-medium shadow-[inset_0_-8px_10px_#ffffff1f]",

              // transition
              "transform-gpu transition-all duration-300 ease-in-out",

              // on hover
              "group-hover:shadow-[inset_0_-6px_10px_#ffffff3f]",

              // on click
              "group-active:shadow-[inset_0_-10px_10px_#ffffff3f]"
            )}
          />

          {/* backdrop */}
          <div className={cn("absolute inset-(--cut) -z-20 rounded-lg [background:var(--bg)]")} />
        </Link>
      </Button>
    );
  }
);

ShimmerButton.displayName = "ShimmerButton";
