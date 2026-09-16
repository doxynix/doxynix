"use client";

import { type ComponentPropsWithoutRef, useRef } from "react";
import { flushSync } from "react-dom";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/shared/lib/cn";
import { getThemeTransitionClipPaths, type TransitionVariant } from "@/shared/lib/theme-transition";

import { AppButton } from "./button";

interface AnimatedThemeTogglerProps extends ComponentPropsWithoutRef<"button"> {
  duration?: number;
  /** When true, the transition expands from the viewport center instead of the button center. */
  fromCenter?: boolean;
  variant?: TransitionVariant;
}

export const AnimatedThemeToggler = ({
  className,
  duration = 300,
  fromCenter = false,
  variant = "circle",
  ...props
}: AnimatedThemeTogglerProps) => {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const buttonRef = useRef<HTMLButtonElement>(null);

  const applyTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  const toggleTheme = () => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (
      typeof document.startViewTransition !== "function" ||
      prefersReducedMotion ||
      !buttonRef.current
    ) {
      applyTheme();
      return;
    }

    const button = buttonRef.current;
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;

    let x: number;
    let y: number;

    if (fromCenter) {
      x = viewportWidth / 2;
      y = viewportHeight / 2;
    } else {
      const rect = button.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    }

    const maxRadius = Math.hypot(Math.max(x, viewportWidth - x), Math.max(y, viewportHeight - y));

    document.documentElement.style.setProperty("will-change", "clip-path");

    try {
      const transition = document.startViewTransition(() => {
        flushSync(() => {
          applyTheme();
        });
      });

      void transition.ready
        .then(() => {
          const clipPath = getThemeTransitionClipPaths(
            variant,
            x,
            y,
            maxRadius,
            viewportWidth,
            viewportHeight,
          );

          document.documentElement.animate(
            { clipPath },
            {
              duration,
              easing: variant === "star" ? "linear" : "ease-in-out",
              fill: "forwards",
              pseudoElement: "::view-transition-new(root)",
            },
          ).onfinish = () => {
            document.documentElement.style.removeProperty("will-change");
          };
        })
        .catch((error) => {
          document.documentElement.style.removeProperty("will-change");
          console.error(error);
        });
    } catch (error) {
      document.documentElement.style.removeProperty("will-change");
      applyTheme();
      console.error(error);
    }
  };

  return (
    <AppButton
      aria-label="Switch theme"
      className={cn(className, "overflow-hidden")}
      onClick={toggleTheme}
      ref={buttonRef}
      size="icon"
      type="button"
      variant="ghost"
      {...props}
    >
      <Sun className="block h-4.5 w-4.5 dark:hidden" />
      <Moon className="hidden h-4.5 w-4.5 dark:block" />
    </AppButton>
  );
};
