import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
} from "react";

import { cn } from "@/shared/lib/cn";
import { Link } from "@/i18n/routing";

import { Button } from "../core/button";

export interface ShimmerButtonProps extends ComponentPropsWithoutRef<"button"> {
  background?: string;
  borderRadius?: string;
  children?: ReactNode;
  className?: string;
  href: string;
  shimmerColor?: string;
  shimmerDuration?: string;
  shimmerSize?: string;
}

export const ShimmerButton = forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  (
    {
      background = "var(--primary)",
      borderRadius = "100px",
      children,
      className,
      href,
      shimmerColor = "var(--primary-foreground)",
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
          "transition-standard group border-border/70 text-primary-foreground hover:border-border-accent hover:text-primary-foreground relative isolate flex cursor-pointer items-center justify-center overflow-hidden rounded-lg border bg-transparent px-6 py-3 whitespace-nowrap shadow-sm hover:bg-transparent hover:[box-shadow:var(--shadow-md)]",
          "active:translate-y-px",
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
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-lg">
            <div className="@container-[size] absolute inset-0 overflow-visible blur-[2px]">
              <div className="animate-shimmer-slide absolute inset-0 aspect-[1] h-[100cqh] rounded-none [mask:none]">
                <div className="animate-spin-around absolute -inset-[220%] block aspect-square [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))]" />
              </div>
            </div>
          </div>

          <div className="absolute inset-(--cut) z-10 rounded-[calc(var(--radius)-var(--cut))] [background:var(--bg)]" />

          <span className="relative z-20 inline-flex items-center justify-center">{children}</span>

          {/* Highlight */}
          <div
            className={cn(
              "absolute inset-0 z-20 size-full rounded-lg",

              // transition
              "transition-standard transform-gpu",

              // on hover
              "group-hover:[box-shadow:inset_0_-6px_10px_color-mix(in_oklab,var(--primary-foreground)_25%,transparent)]",

              // on click
              "group-active:[box-shadow:inset_0_-10px_10px_color-mix(in_oklab,var(--primary-foreground)_25%,transparent)]"
            )}
          />
        </Link>
      </Button>
    );
  }
);

ShimmerButton.displayName = "ShimmerButton";
