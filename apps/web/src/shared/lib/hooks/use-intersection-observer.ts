"use client";

import { useCallback, useEffect, useRef } from "react";

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

  // Stable identity: callers keep these in effect dependencies.
  const observe = useCallback((element: Element) => {
    observerRef.current?.observe(element);
  }, []);

  const unobserve = useCallback((element: Element) => {
    observerRef.current?.unobserve(element);
  }, []);

  return { observe, unobserve };
}
