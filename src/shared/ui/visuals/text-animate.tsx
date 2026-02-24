/* eslint-disable react-hooks/static-components */
"use client";

import { memo, type ElementType } from "react";
import { AnimatePresence, motion, type MotionProps, type Variants } from "motion/react";

import { cn } from "@/shared/lib/utils";

type AnimationType = "text" | "word" | "character" | "line";
type AnimationVariant =
  | "fadeIn"
  | "blurIn"
  | "blurInUp"
  | "blurInDown"
  | "slideUp"
  | "slideDown"
  | "slideLeft"
  | "slideRight"
  | "scaleUp"
  | "scaleDown";

interface TextAnimateProps extends MotionProps {
  /**
   * Whether to enable accessibility features (default: true)
   */
  accessible?: boolean;
  /**
   * The animation preset to use
   */
  animation?: AnimationVariant;
  /**
   * The element type to render
   */
  as?: ElementType;
  /**
   * How to split the text ("text", "word", "character")
   */
  by?: AnimationType;
  /**
   * The text content to animate
   */
  children: string;
  /**
   * The class name to be applied to the component
   */
  className?: string;
  /**
   * The delay before the animation starts
   */
  delay?: number;
  /**
   * The duration of the animation
   */
  duration?: number;
  /**
   * Whether to animate only once
   */
  once?: boolean;
  /**
   * The class name to be applied to each segment
   */
  segmentClassName?: string;
  /**
   * Whether to start animation when component enters viewport
   */
  startOnView?: boolean;
  /**
   * Custom motion variants for the animation
   */
  variants?: Variants;
}

const staggerTimings: Record<AnimationType, number> = {
  character: 0.03,
  line: 0.06,
  text: 0.06,
  word: 0.05,
};

const defaultContainerVariants = {
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

const defaultItemVariants: Variants = {
  exit: {
    opacity: 0,
  },
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
  },
};

const defaultItemAnimationVariants: Record<
  AnimationVariant,
  { container: Variants; item: Variants }
> = {
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
  const MotionComponent = motion.create(Component);

  let segments: string[] = [];
  switch (by) {
    case "word":
      segments = children.split(/(\s+)/);
      break;
    case "character":
      segments = children.split("");
      break;
    case "line":
      segments = children.split("\n");
      break;
    case "text":
    default:
      segments = [children];
      break;
  }

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
    : // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      animation
      ? {
          container: {
            ...defaultItemAnimationVariants[animation].container,
            exit: {
              ...defaultItemAnimationVariants[animation].container.exit,
              transition: {
                staggerChildren: duration / segments.length,
                staggerDirection: -1,
              },
            },
            show: {
              ...defaultItemAnimationVariants[animation].container.show,
              transition: {
                delayChildren: delay,
                staggerChildren: duration / segments.length,
              },
            },
          },
          item: defaultItemAnimationVariants[animation].item,
        }
      : { container: defaultContainerVariants, item: defaultItemVariants };

  return (
    <AnimatePresence mode="popLayout">
      <MotionComponent
        animate={startOnView ? undefined : "show"}
        exit="exit"
        initial="hidden"
        variants={finalVariants.container as Variants}
        viewport={{ once }}
        whileInView={startOnView ? "show" : undefined}
        aria-label={accessible ? children : undefined}
        className={cn("whitespace-pre-wrap", className)}
        {...props}
      >
        {accessible && <span className="sr-only">{children}</span>}
        {segments.map((segment, i) => (
          <motion.span
            key={`${by}-${segment}-${i}`}
            custom={i * staggerTimings[by]}
            variants={finalVariants.item}
            aria-hidden={accessible ? true : undefined}
            className={cn(
              by === "line" ? "block" : "inline-block whitespace-pre",
              by === "character" && "",
              segmentClassName
            )}
          >
            {segment}
          </motion.span>
        ))}
      </MotionComponent>
    </AnimatePresence>
  );
};

// Export the memoized version
export const TextAnimate = memo(TextAnimateBase);
