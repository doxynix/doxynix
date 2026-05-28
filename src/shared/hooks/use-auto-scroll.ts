"use client";

import { useEffect, useRef, useState, type DependencyList } from "react";

export function useAutoScroll<T extends HTMLElement>(deps: DependencyList) {
  const scrollRef = useRef<T>(null);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const handleScroll = () => {
    const root = scrollRef.current;
    if (!root) return;

    const container = root.querySelector("[data-radix-scroll-area-viewport]") || root;
    const { clientHeight, scrollHeight, scrollTop } = container;

    const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;

    setIsAutoScroll(isAtBottom);
    setShowScrollButton(!isAtBottom);
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const root = scrollRef.current;
    if (!root) return;

    const container = root.querySelector("[data-radix-scroll-area-viewport]") || root;
    container.scrollTo({
      behavior,
      top: container.scrollHeight,
    });
    setIsAutoScroll(true);
  };

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const container = root.querySelector("[data-radix-scroll-area-viewport]") || root;
    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [deps]);

  useEffect(() => {
    if (isAutoScroll) {
      scrollToBottom("instant");
    }
  }, [deps, isAutoScroll]);

  return {
    handleScroll,
    scrollRef,
    scrollToBottom,
    showScrollButton,
  };
}
