"use client";

import { useEffect, useLayoutEffect, useRef, useState, type DependencyList } from "react";

export function useAutoScroll<T extends HTMLElement>(
  deps: DependencyList,
  options: { selector?: string; throttleMs?: number } = {},
) {
  const { selector = "[data-radix-scroll-area-viewport]", throttleMs = 100 } = options;

  const scrollRef = useRef<null | T>(null);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const isAutoScrollRef = useRef(isAutoScroll);

  useLayoutEffect(() => {
    isAutoScrollRef.current = isAutoScroll;
  }, [isAutoScroll]);

  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getContainer = (): HTMLElement | null => {
    const root = scrollRef.current;
    if (root == null) return null;
    return root.querySelector(selector);
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const container = getContainer();
    if (container == null) return;

    container.scrollTo({
      behavior,
      top: container.scrollHeight,
    });
    setIsAutoScroll(true);
  };

  const handleScrollThrottled = () => {
    if (throttleTimeoutRef.current) return;

    throttleTimeoutRef.current = setTimeout(() => {
      throttleTimeoutRef.current = null;

      const container = getContainer();
      if (container == null) return;

      const { clientHeight, scrollHeight, scrollTop } = container;

      const isAtBottom = scrollHeight - scrollTop - clientHeight < 15;

      setIsAutoScroll(isAtBottom);
      setShowScrollButton(!isAtBottom);
    }, throttleMs);
  };

  useEffect(() => {
    const container = getContainer();
    if (container == null) return;

    container.addEventListener("scroll", handleScrollThrottled, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScrollThrottled);
      if (throttleTimeoutRef.current) clearTimeout(throttleTimeoutRef.current);
    };
  }, [selector]);

  useEffect(() => {
    const container = getContainer();
    if (container == null || !isAutoScrollRef.current) return;

    const triggerScroll = () => {
      container.scrollTo({ behavior: "instant", top: container.scrollHeight });
    };

    triggerScroll();

    const observer = new ResizeObserver(() => {
      if (isAutoScrollRef.current) triggerScroll();
    });

    if (container.firstElementChild) {
      observer.observe(container.firstElementChild);
    } else {
      observer.observe(container);
    }

    return () => observer.disconnect();
  }, deps);

  return {
    scrollRef,
    scrollToBottom,
    showScrollButton,
  };
}
