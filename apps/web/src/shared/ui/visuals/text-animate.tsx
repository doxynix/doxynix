"use client";

import { type ElementType, useState } from "react";
import { AnimatePresence, type MotionProps, motion, type Variants } from "motion/react";

import { cn } from "@/shared/lib/cn";

import {
  type AnimationType,
  type AnimationVariant,
  defaultItemAnimationVariants,
  staggerTimings,
} from "./text-animate.variants";

interface TextAnimateProps extends MotionProps {
  accessible?: boolean;
  animation?: AnimationVariant;
  as?: ElementType;
  by?: AnimationType;
  children: string;
  className?: string;
  delay?: number;
  duration?: number;
  once?: boolean;
  segmentClassName?: string;
  startOnView?: boolean;
  variants?: Variants;
}

const TextAnimateBase = ({
  accessible = true,
  animation = "fadeIn",
  as: Component = "p",
  by = "word",
  children,
  className,
  delay = 0,
  duration = 0.3,
  once = false,
  segmentClassName,
  startOnView = true,
  variants,
  ...props
}: TextAnimateProps) => {
  // Lazily built once per mount: keeps the render pure and avoids re-creating the component identity every render.
  const [MotionComponent] = useState(() => motion.create(Component));

  let segments: string[] = [];
  switch (by) {
    case "word": {
      segments = children.split(/(\s+)/);
      break;
    }
    case "character": {
      segments = children.split("");
      break;
    }
    case "line": {
      segments = children.split("\n");
      break;
    }
    case "text":
    default: {
      segments = [children];
      break;
    }
  }

  const selectedAnimation = defaultItemAnimationVariants[animation];
  const containerExit =
    typeof selectedAnimation.container.exit === "object" ? selectedAnimation.container.exit : {};
  const containerShow =
    typeof selectedAnimation.container.show === "object" ? selectedAnimation.container.show : {};

  const finalVariants = variants
    ? {
        container: {
          exit: {
            opacity: 0,
            transition: {
              staggerChildren: duration / segments.length,
              staggerDirection: -1,
            },
          },
          hidden: { opacity: 0 },
          show: {
            opacity: 1,
            transition: {
              delayChildren: delay,
              opacity: { delay, duration: 0.01 },
              staggerChildren: duration / segments.length,
            },
          },
        },
        item: variants,
      }
    : {
        container: {
          ...selectedAnimation.container,
          exit: {
            ...containerExit,
            transition: {
              staggerChildren: duration / segments.length,
              staggerDirection: -1,
            },
          },
          show: {
            ...containerShow,
            transition: {
              delayChildren: delay,
              staggerChildren: duration / segments.length,
            },
          },
        },
        item: selectedAnimation.item,
      };

  return (
    <AnimatePresence mode="popLayout">
      <MotionComponent
        animate={startOnView ? undefined : "show"}
        aria-label={accessible ? children : undefined}
        className={cn("whitespace-pre-wrap", className)}
        exit="exit"
        initial="hidden"
        variants={finalVariants.container}
        viewport={{ once }}
        whileInView={startOnView ? "show" : undefined}
        {...props}
      >
        {accessible && <span className="sr-only">{children}</span>}
        {segments.map((segment, i) => (
          <motion.span
            aria-hidden={accessible ? true : undefined}
            className={cn(
              by === "line" ? "block" : "inline-block whitespace-pre",
              by === "character" && "",
              segmentClassName,
            )}
            custom={i * staggerTimings[by]}
            key={`${by}-${segment}-${i}`}
            variants={finalVariants.item}
          >
            {segment}
          </motion.span>
        ))}
      </MotionComponent>
    </AnimatePresence>
  );
};

// Export the plain component; React Compiler memoizes render output automatically
export const TextAnimate = TextAnimateBase;
