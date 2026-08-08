import { useState } from "react";

type Size = {
  height: number;
  width: number;
};

export function useResizeObserver<T extends HTMLElement>() {
  const [size, setSize] = useState<Size>({ height: 0, width: 0 });

  const ref = (node: null | T) => {
    if (node == null) {
      return () => {};
    }

    const { height, width } = node.getBoundingClientRect();
    setSize({ height, width });

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry == null) return;

      const { height: newHeight, width: newWidth } = entry.contentRect;

      setSize((prev) => {
        if (prev.width === newWidth && prev.height === newHeight) return prev;
        return { height: newHeight, width: newWidth };
      });
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  };

  return [ref, size] as const;
}
