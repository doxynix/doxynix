"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";
import { useInView, useMotionValue, useSpring } from "motion/react";
import { useLocale } from "next-intl";

import { cn } from "@/shared/lib/utils";

interface NumberTickerProps extends ComponentPropsWithoutRef<"span"> {
  decimalPlaces?: number;
  delay?: number;
  direction?: "up" | "down";
  startValue?: number;
  value: number;
}

export function NumberTicker({
  className,
  decimalPlaces = 0,
  delay = 0,
  direction = "up",
  startValue = 0,
  value,
  ...props
}: Readonly<NumberTickerProps>) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(direction === "down" ? value : startValue);
  const springValue = useSpring(motionValue, {
    damping: 60,
    stiffness: 100,
  });
  const isInView = useInView(ref, { margin: "0px", once: true });
  const locale = useLocale();

  useEffect(() => {
    if (isInView) {
      const timer = setTimeout(() => {
        motionValue.set(direction === "down" ? startValue : value);
      }, delay * 1000);
      return () => clearTimeout(timer);
    }
  }, [motionValue, isInView, delay, value, direction, startValue]);

  useEffect(() => {
    const updateText = (latest: number) => {
      if (ref.current) {
        ref.current.textContent = Intl.NumberFormat(locale, {
          maximumFractionDigits: decimalPlaces,
          minimumFractionDigits: decimalPlaces,
        }).format(Number(latest.toFixed(decimalPlaces)));
      }
    };

    const unsubscribe = springValue.on("change", updateText);

    updateText(springValue.get());

    return () => unsubscribe();
  }, [springValue, decimalPlaces, locale]);

  return (
    <span
      ref={ref}
      className={cn(
        "inline-block tracking-wider text-black tabular-nums dark:text-white",
        className
      )}
      {...props}
    >
      {startValue}
    </span>
  );
}
