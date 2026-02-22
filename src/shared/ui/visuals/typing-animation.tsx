"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView, type MotionProps } from "motion/react";

import { cn } from "@/shared/lib/utils";

interface TypingAnimationProps extends MotionProps {
  as?: React.ElementType;
  blinkCursor?: boolean;
  children?: string;
  className?: string;
  cursorStyle?: "line" | "block" | "underscore";
  delay?: number;
  deleteSpeed?: number;
  duration?: number;
  loop?: boolean;
  pauseDelay?: number;
  showCursor?: boolean;
  startOnView?: boolean;
  typeSpeed?: number;
  words?: string[];
}

export function TypingAnimation({
  as: Component = "span",
  blinkCursor = true,
  children,
  className,
  cursorStyle = "line",
  delay = 0,
  deleteSpeed,
  duration = 100,
  loop = false,
  pauseDelay = 1000,
  showCursor = true,
  startOnView = true,
  typeSpeed,
  words,
  ...props
}: Readonly<TypingAnimationProps>) {
  const MotionComponent = motion.create(Component, {
    forwardMotionProps: true,
  });

  const [displayedText, setDisplayedText] = useState<string>("");
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [phase, setPhase] = useState<"typing" | "pause" | "deleting">("typing");
  const elementRef = useRef<HTMLElement | null>(null);
  const isInView = useInView(elementRef as React.RefObject<Element>, {
    amount: 0.3,
    once: true,
  });

  const wordsToAnimate = useMemo(() => words || (children ? [children] : []), [words, children]);
  const hasMultipleWords = wordsToAnimate.length > 1;

  const typingSpeed = typeSpeed || duration;
  const deletingSpeed = deleteSpeed || typingSpeed / 2;

  const shouldStart = startOnView ? isInView : true;

  useEffect(() => {
    if (!shouldStart || wordsToAnimate.length === 0) return;

    const timeoutDelay =
      delay > 0 && displayedText === ""
        ? delay
        : phase === "typing"
          ? typingSpeed
          : phase === "deleting"
            ? deletingSpeed
            : pauseDelay;

    const timeout = setTimeout(() => {
      const currentWord = wordsToAnimate[currentWordIndex] || "";
      const graphemes = Array.from(currentWord);

      switch (phase) {
        case "typing":
          if (currentCharIndex < graphemes.length) {
            setDisplayedText(graphemes.slice(0, currentCharIndex + 1).join(""));
            setCurrentCharIndex(currentCharIndex + 1);
          } else {
            if (hasMultipleWords || loop) {
              const isLastWord = currentWordIndex === wordsToAnimate.length - 1;
              if (!isLastWord || loop) {
                setPhase("pause");
              }
            }
          }
          break;

        case "pause":
          setPhase("deleting");
          break;

        case "deleting":
          if (currentCharIndex > 0) {
            setDisplayedText(graphemes.slice(0, currentCharIndex - 1).join(""));
            setCurrentCharIndex(currentCharIndex - 1);
          } else {
            const nextIndex = (currentWordIndex + 1) % wordsToAnimate.length;
            setCurrentWordIndex(nextIndex);
            setPhase("typing");
          }
          break;
      }
    }, timeoutDelay);

    return () => clearTimeout(timeout);
  }, [
    shouldStart,
    phase,
    currentCharIndex,
    currentWordIndex,
    displayedText,
    wordsToAnimate,
    hasMultipleWords,
    loop,
    typingSpeed,
    deletingSpeed,
    pauseDelay,
    delay,
  ]);

  const currentWordGraphemes = Array.from(wordsToAnimate[currentWordIndex] || "");
  const isComplete =
    !loop &&
    currentWordIndex === wordsToAnimate.length - 1 &&
    currentCharIndex >= currentWordGraphemes.length &&
    phase !== "deleting";

  const shouldShowCursor =
    showCursor &&
    !isComplete &&
    (hasMultipleWords || loop || currentCharIndex < currentWordGraphemes.length);

  const getCursorChar = () => {
    switch (cursorStyle) {
      case "block":
        return "▌";
      case "underscore":
        return "_";
      case "line":
      default:
        return "|";
    }
  };

  return (
    // eslint-disable-next-line react-hooks/static-components
    <MotionComponent
      ref={elementRef}
      className={cn("leading-20 tracking-[-0.02em]", className)}
      {...props}
    >
      {displayedText}
      {shouldShowCursor && (
        <span className={cn("inline-block", blinkCursor && "animate-blink-cursor")}>
          {getCursorChar()}
        </span>
      )}
    </MotionComponent>
  );
}
