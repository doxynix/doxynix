"use client";

import { useEffect, useRef } from "react";

export function useIntersectionObserver(
  callback: (entries: IntersectionObserverEntry[]) => void,
  options?: IntersectionObserverInit,
) {
  const callbackRef = useRef(callback);
  const optionsRef = useRef(options);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
    optionsRef.current = options;
  }, [callback, options]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      callbackRef.current(entries);
    }, optionsRef.current);

    observerRef.current = observer;

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, []);

  // Stable identity without useCallback: React Compiler memoizes these (no reactive deps).
  const observe = (element: Element) => {
    observerRef.current?.observe(element);
  };

  const unobserve = (element: Element) => {
    observerRef.current?.unobserve(element);
  };

  return { observe, unobserve };
}
