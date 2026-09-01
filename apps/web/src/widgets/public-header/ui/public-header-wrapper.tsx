"use client";

import { type ReactNode, useRef, useState } from "react";
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
        className="fixed inset-x-0 top-0 z-50 h-16"
        onMouseEnter={() => setIsHidden(false)}
      />

      <motion.div
        animate={isHidden ? "hidden" : "visible"}
        className={
          "glass-panel fixed top-0 z-50 w-full border-border border-b bg-background/76 transition-standard supports-backdrop-filter:bg-background/64"
        }
        onFocusCapture={() => setIsHidden(false)}
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
      >
        <div className="relative border-transparent border-b transition-standard">{children}</div>
      </motion.div>
    </>
  );
}
