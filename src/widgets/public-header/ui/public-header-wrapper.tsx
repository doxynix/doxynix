"use client";

import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useScroll } from "motion/react";

export function PublicHeaderWrapper({ children }: Readonly<{ children: React.ReactNode }>) {
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
      <div onMouseEnter={() => setIsHidden(false)} className="fixed inset-x-0 top-0 z-50 h-16" />

      <motion.div
        animate={isHidden ? "hidden" : "visible"}
        transition={{
          duration: 0.5,
          ease: [0.23, 1, 0.32, 1],
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
          "supports-backdrop-filter:bg-background/60 border-border bg-background/80 fixed top-0 z-50 w-full border-b backdrop-blur-sm transition-shadow duration-500"
        }
      >
        <div className="relative border-b border-transparent transition-colors duration-500">
          {children}
        </div>
      </motion.div>
    </>
  );
}
