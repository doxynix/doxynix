"use client";

import type { CSSProperties } from "react";
import { motion, type MotionStyle, type Transition } from "motion/react";

import { cn } from "@/shared/lib/cn";

type BorderBeamProps = {
  /**
   * The border width of the beam.
   */
  borderWidth?: number;
  /**
   * The class name of the border beam.
   */
  className?: string;
  /**
   * The color of the border beam from.
   */
  colorFrom?: string;
  /**
   * The color of the border beam to.
   */
  colorTo?: string;
  /**
   * The delay of the border beam.
   */
  delay?: number;
  /**
   * The duration of the border beam.
   */
  duration?: number;
  /**
   * The initial offset position (0-100).
   */
  initialOffset?: number;
  /**
   * Whether to reverse the animation direction.
   */
  reverse?: boolean;
  /**
   * The size of the border beam.
   */
  size?: number;
  /**
   * The style of the border beam.
   */
  style?: CSSProperties;
  /**
   * The motion transition of the border beam.
   */
  transition?: Transition;
};

export const BorderBeam = ({
  borderWidth = 1,
  className,
  colorFrom = "var(--brand-tech)",
  colorTo = "var(--brand-ai)",
  delay = 0,
  duration = 6,
  initialOffset = 0,
  reverse = false,
  size = 50,
  style,
  transition,
}: BorderBeamProps) => {
  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-[inherit] border-(length:--border-beam-width) border-transparent mask-[linear-gradient(transparent,transparent),linear-gradient(#000,#000)] mask-intersect [mask-clip:padding-box,border-box]"
      style={
        {
          "--border-beam-width": `${borderWidth}px`,
        } as CSSProperties
      }
    >
      <motion.div
        animate={{
          offsetDistance: reverse
            ? [`${100 - initialOffset}%`, `${-initialOffset}%`]
            : [`${initialOffset}%`, `${100 + initialOffset}%`],
        }}
        initial={{ offsetDistance: `${initialOffset}%` }}
        transition={{
          delay: -delay,
          duration,
          ease: "linear",
          repeat: Infinity,
          ...transition,
        }}
        className={cn(
          "absolute aspect-square",
          "bg-linear-to-l from-(--color-from) via-(--color-to) to-transparent",
          className
        )}
        style={
          {
            "--color-from": colorFrom,
            "--color-to": colorTo,
            offsetPath: `rect(0 auto auto 0 round ${size}px)`,
            width: size,
            ...style,
          } as MotionStyle
        }
      />
    </div>
  );
};
