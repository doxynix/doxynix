import type { Variants } from "motion/react";

export type AnimationType = "character" | "line" | "text" | "word";
export type AnimationVariant =
  | "blurIn"
  | "blurInDown"
  | "blurInUp"
  | "fadeIn"
  | "scaleDown"
  | "scaleUp"
  | "slideDown"
  | "slideLeft"
  | "slideRight"
  | "slideUp";

export const staggerTimings: Record<AnimationType, number> = {
  character: 0.03,
  line: 0.06,
  text: 0.06,
  word: 0.05,
};

export const defaultContainerVariants = {
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: {
      delayChildren: 0,
      staggerChildren: 0.05,
    },
  },
};

export const ENTER_EASING = [0.16, 1, 0.3, 1] as const;
export const EXIT_EASING = [0.4, 0, 1, 1] as const;
export const ENTER_DURATION = 0.45;
export const EXIT_DURATION = 0.25;

type TransitionMap = Record<string, unknown>;

function hasPerPropertyTransitions(transition: TransitionMap): boolean {
  return Object.values(transition).some(
    (value) => value !== undefined && value !== null && typeof value === "object",
  );
}

function resolveBaseDuration(transition: TransitionMap, kind: "enter" | "exit"): number {
  if (typeof transition.duration === "number" && transition.duration > 0) {
    return transition.duration;
  }

  return kind === "enter" ? ENTER_DURATION : EXIT_DURATION;
}

export function withTastefulEasing(
  transition: TransitionMap,
  kind: "enter" | "exit",
): TransitionMap {
  // Springs / per-property transitions keep their own physics.
  if (hasPerPropertyTransitions(transition)) {
    return transition;
  }

  const current = resolveBaseDuration(transition, kind);

  return {
    ...transition,
    duration:
      kind === "enter" ? Math.max(current, ENTER_DURATION) : Math.min(current, EXIT_DURATION),
    ease: kind === "enter" ? [...ENTER_EASING] : [...EXIT_EASING],
  };
}

/** Copy of the current variants table in text-animate.tsx (lines 97–293). */
const rawItemAnimationVariants: Record<AnimationVariant, { container: Variants; item: Variants }> =
  {
    blurIn: {
      container: defaultContainerVariants,
      item: {
        exit: {
          filter: "blur(10px)",
          opacity: 0,
          transition: { duration: 0.3 },
        },
        hidden: { filter: "blur(10px)", opacity: 0 },
        show: {
          filter: "blur(0px)",
          opacity: 1,
          transition: {
            duration: 0.3,
          },
        },
      },
    },
    blurInDown: {
      container: defaultContainerVariants,
      item: {
        hidden: { filter: "blur(10px)", opacity: 0, y: -20 },
        show: {
          filter: "blur(0px)",
          opacity: 1,
          transition: {
            filter: { duration: 0.3 },
            opacity: { duration: 0.4 },
            y: { duration: 0.3 },
          },
          y: 0,
        },
      },
    },
    blurInUp: {
      container: defaultContainerVariants,
      item: {
        exit: {
          filter: "blur(10px)",
          opacity: 0,
          transition: {
            filter: { duration: 0.3 },
            opacity: { duration: 0.4 },
            y: { duration: 0.3 },
          },
          y: 20,
        },
        hidden: { filter: "blur(10px)", opacity: 0, y: 20 },
        show: {
          filter: "blur(0px)",
          opacity: 1,
          transition: {
            filter: { duration: 0.3 },
            opacity: { duration: 0.4 },
            y: { duration: 0.3 },
          },
          y: 0,
        },
      },
    },
    fadeIn: {
      container: defaultContainerVariants,
      item: {
        exit: {
          opacity: 0,
          transition: { duration: 0.3 },
          y: 20,
        },
        hidden: { opacity: 0, y: 20 },
        show: {
          opacity: 1,
          transition: {
            duration: 0.3,
          },
          y: 0,
        },
      },
    },
    scaleDown: {
      container: defaultContainerVariants,
      item: {
        exit: {
          opacity: 0,
          scale: 1.5,
          transition: { duration: 0.3 },
        },
        hidden: { opacity: 0, scale: 1.5 },
        show: {
          opacity: 1,
          scale: 1,
          transition: {
            duration: 0.3,
            scale: {
              damping: 15,
              stiffness: 300,
              type: "spring",
            },
          },
        },
      },
    },
    scaleUp: {
      container: defaultContainerVariants,
      item: {
        exit: {
          opacity: 0,
          scale: 0.5,
          transition: { duration: 0.3 },
        },
        hidden: { opacity: 0, scale: 0.5 },
        show: {
          opacity: 1,
          scale: 1,
          transition: {
            duration: 0.3,
            scale: {
              damping: 15,
              stiffness: 300,
              type: "spring",
            },
          },
        },
      },
    },
    slideDown: {
      container: defaultContainerVariants,
      item: {
        exit: {
          opacity: 0,
          transition: { duration: 0.3 },
          y: 20,
        },
        hidden: { opacity: 0, y: -20 },
        show: {
          opacity: 1,
          transition: { duration: 0.3 },
          y: 0,
        },
      },
    },
    slideLeft: {
      container: defaultContainerVariants,
      item: {
        exit: {
          opacity: 0,
          transition: { duration: 0.3 },
          x: -20,
        },
        hidden: { opacity: 0, x: 20 },
        show: {
          opacity: 1,
          transition: { duration: 0.3 },
          x: 0,
        },
      },
    },
    slideRight: {
      container: defaultContainerVariants,
      item: {
        exit: {
          opacity: 0,
          transition: { duration: 0.3 },
          x: 20,
        },
        hidden: { opacity: 0, x: -20 },
        show: {
          opacity: 1,
          transition: { duration: 0.3 },
          x: 0,
        },
      },
    },
    slideUp: {
      container: defaultContainerVariants,
      item: {
        exit: {
          opacity: 0,
          transition: {
            duration: 0.3,
          },
          y: -20,
        },
        hidden: { opacity: 0, y: 20 },
        show: {
          opacity: 1,
          transition: {
            duration: 0.3,
          },
          y: 0,
        },
      },
    },
  };

function normalizeItemTransitions(item: Variants): Variants {
  return {
    ...item,
    ...(item.show !== undefined && typeof item.show === "object"
      ? {
          show: {
            ...item.show,
            transition: withTastefulEasing(
              (item.show as { transition?: TransitionMap }).transition ?? {},
              "enter",
            ),
          },
        }
      : {}),
    ...(item.exit !== undefined && typeof item.exit === "object"
      ? {
          exit: {
            ...item.exit,
            transition: withTastefulEasing(
              (item.exit as { transition?: TransitionMap }).transition ?? {},
              "exit",
            ),
          },
        }
      : {}),
  };
}

export const defaultItemAnimationVariants: Record<
  AnimationVariant,
  { container: Variants; item: Variants }
> = Object.fromEntries(
  Object.entries(rawItemAnimationVariants).map(([name, { container, item }]) => [
    name,
    { container, item: normalizeItemTransitions(item) },
  ]),
) as Record<AnimationVariant, { container: Variants; item: Variants }>;
