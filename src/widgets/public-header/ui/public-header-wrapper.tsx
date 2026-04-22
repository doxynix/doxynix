"use client";

import { useRef, useState, type ReactNode } from "react";
import { motion, useMotionValueEvent, useScroll } from "motion/react";

export function PublicHeaderWrapper({ children }: Readonly<{ children: ReactNode }>) {
  const [isHidden, setIsHidden] = useState(false);

  const { scrollY } = useScroll();
  const lastScrollY = useRef(0);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = lastScrollY.current;
    const velocity = latest - previous;

    if (latest < 10) {
      setIsHidden(false);
    }

    if (latest > 150) {
      if (velocity > 10 && !isHidden) {
        setIsHidden(true);
      } else if (velocity < -25 && isHidden) {
        setIsHidden(false);
      }
    }

    lastScrollY.current = latest;
  });

  return (
    <>
      <div
        aria-hidden="true"
        onMouseEnter={() => setIsHidden(false)}
        className="fixed inset-x-0 top-0 z-50 h-16"
      />

      <motion.div
        animate={isHidden ? "hidden" : "visible"}
        transition={{
          duration: 0.18,
          ease: [0.4, 0, 0.2, 1],
        }}
        variants={{
          hidden: {
            opacity: 0,
            pointerEvents: "none",
            y: "-100%",
          },
          visible: {
            opacity: 1,
            pointerEvents: "auto",
            y: 0,
          },
        }}
        onFocusCapture={() => setIsHidden(false)}
        className={
          "transition-standard supports-backdrop-filter:bg-background/64 glass-panel border-border/80 bg-background/76 fixed top-0 z-50 w-full border-b"
        }
      >
        <div className="transition-standard relative border-b border-transparent">{children}</div>
      </motion.div>
    </>
  );
}
