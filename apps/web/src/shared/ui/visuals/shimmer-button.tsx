import {
  type ComponentPropsWithoutRef,
  type ComponentRef,
  type CSSProperties,
  forwardRef,
  type ReactNode,
} from "react";

import { Link } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/cn";

import { AppButton } from "../core/button";

interface ShimmerButtonProps extends ComponentPropsWithoutRef<typeof Link> {
  background?: string;
  borderRadius?: string;
  children?: ReactNode;
  className?: string;
  shimmerColor?: string;
  shimmerDuration?: string;
  shimmerSize?: string;
}

export const ShimmerButton = forwardRef<ComponentRef<typeof Link>, ShimmerButtonProps>(
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
      style,
      ...props
    },
    ref,
  ) => {
    return (
      <AppButton
        asChild
        className={cn(
          "group relative isolate flex cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap rounded-(--radius) border border-border bg-transparent px-6 py-3 text-primary-foreground shadow-sm transition-standard hover:border-border-accent hover:bg-transparent hover:text-primary-foreground hover:[box-shadow:var(--shadow-md)]",
          "active:translate-y-px",
          className,
        )}
        style={
          {
            ...style,
            "--bg": background,
            "--cut": shimmerSize,
            "--radius": borderRadius,
            "--shimmer-color": shimmerColor,
            "--speed": shimmerDuration,
            "--spread": "90deg",
          } as CSSProperties
        }
      >
        <Link href={href} ref={ref} {...props}>
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-(--radius)">
            <div className="@container-size absolute inset-0 overflow-visible blur-[2px]">
              <div className="absolute inset-0 aspect-[1] h-[100cqh] animate-shimmer-slide rounded-none [mask:none]">
                <div className="absolute inset-[-220%] block aspect-square animate-spin-around [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))]" />
              </div>
            </div>
          </div>

          <div className="absolute inset-(--cut) z-10 rounded-[calc(var(--radius)-var(--cut))] [background:var(--bg)]" />

          <span className="relative z-20 inline-flex items-center justify-center">{children}</span>

          {/* Highlight */}
          <div
            className={cn(
              "absolute inset-0 z-20 size-full rounded-(--radius)",

              // transition
              "transform-gpu transition-standard",

              // on hover
              "group-hover:[box-shadow:inset_0_-6px_10px_color-mix(in_oklab,var(--primary-foreground)_25%,transparent)]",

              // on click
              "group-active:[box-shadow:inset_0_-10px_10px_color-mix(in_oklab,var(--primary-foreground)_25%,transparent)]",
            )}
          />
        </Link>
      </AppButton>
    );
  },
);

ShimmerButton.displayName = "ShimmerButton";
