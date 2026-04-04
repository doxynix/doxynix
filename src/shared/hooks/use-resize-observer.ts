import { useCallback, useRef, useState } from "react";

type Size = {
  height: number;
  width: number;
};

export function useResizeObserver<T extends HTMLElement>() {
  const [size, setSize] = useState<Size>({ height: 0, width: 0 });

  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (node) {
      const { height, width } = node.getBoundingClientRect();
      setSize({ height, width });

      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];

        const { height: newHeight, width: newWidth } = entry.contentRect;

        setSize((prev) => {
          if (prev.width === newWidth && prev.height === newHeight) return prev;
          return { height: newHeight, width: newWidth };
        });
      });

      observer.observe(node);
      observerRef.current = observer;
    }
  }, []);

  return [ref, size] as const;
}
