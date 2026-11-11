"use client";

import { type DependencyList, useEffect, useLayoutEffect, useRef, useState } from "react";

function getScrollContainer(root: HTMLElement | null, selector: string): HTMLElement | null {
  if (root == null) {
    return null;
  }

  return root.querySelector(selector);
}

export function useAutoScroll<T extends HTMLElement>(
  deps: DependencyList,
  options: { selector?: string; throttleMs?: number } = {},
) {
  const selector = options.selector ?? "[data-radix-scroll-area-viewport]";
  const throttleMs = options.throttleMs ?? 100;

  const scrollRef = useRef<null | T>(null);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const isAutoScrollRef = useRef(isAutoScroll);

  useLayoutEffect(() => {
    isAutoScrollRef.current = isAutoScroll;
  }, [isAutoScroll]);

  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const container = getScrollContainer(scrollRef.current, selector);
    if (container == null) {
      return;
    }

    container.scrollTo({
      behavior,
      top: container.scrollHeight,
    });
    setIsAutoScroll(true);
  };

  useEffect(() => {
    const container = getScrollContainer(scrollRef.current, selector);
    if (container == null) {
      return;
    }

    const handleScroll = () => {
      if (throttleTimeoutRef.current) {
        return;
      }

      throttleTimeoutRef.current = setTimeout(() => {
        throttleTimeoutRef.current = null;

        const currentContainer = getScrollContainer(scrollRef.current, selector);
        if (currentContainer == null) {
          return;
        }

        const { clientHeight, scrollHeight, scrollTop } = currentContainer;

        const isAtBottom = isNearBottom(scrollHeight, scrollTop, clientHeight);

        setIsAutoScroll(isAtBottom);
        setShowScrollButton(!isAtBottom);
      }, throttleMs);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
        throttleTimeoutRef.current = null;
      }
    };
  }, [selector, throttleMs]);

  useEffect(() => {
    const container = getScrollContainer(scrollRef.current, selector);
    if (container == null || !isAutoScrollRef.current) {
      return;
    }

    const triggerScroll = () => {
      container.scrollTo({ behavior: "instant", top: container.scrollHeight });
    };

    triggerScroll();

    const observer = new ResizeObserver(() => {
      if (isAutoScrollRef.current) {
        triggerScroll();
      }
    });

    if (container.firstElementChild) {
      observer.observe(container.firstElementChild);
    } else {
      observer.observe(container);
    }

    return () => observer.disconnect();
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- callers own the dependency list
  }, [selector, ...deps]);

  return {
    scrollRef,
    scrollToBottom,
    showScrollButton,
  };
}

export function isNearBottom(
  scrollHeight: number,
  scrollTop: number,
  clientHeight: number,
): boolean {
  return scrollHeight - scrollTop - clientHeight < 15;
}
