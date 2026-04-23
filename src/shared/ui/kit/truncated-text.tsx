"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";

import { cn } from "@/shared/lib/cn";

import { AppTooltip } from "./app-tooltip";

type Props = {
  className?: string;
  text: string;
  tooltipProps?: Omit<ComponentProps<typeof AppTooltip>, "children" | "content">;
};

export function TruncatedText({ className, text, tooltipProps }: Readonly<Props>) {
  const [isTruncated, setIsTruncated] = useState(false);
  const observerRef = useRef<null | ResizeObserver>(null);

  const setRef = (node: HTMLSpanElement | null) => {
    if (observerRef.current) observerRef.current.disconnect();

    if (node) {
      const checkTruncation = () => {
        requestAnimationFrame(() => {
          const hasOverflow =
            Math.ceil(node.scrollWidth) > Math.ceil(node.getBoundingClientRect().width);
          setIsTruncated(hasOverflow);
        });
      };

      checkTruncation();
      observerRef.current = new ResizeObserver(checkTruncation);
      observerRef.current.observe(node);
    }
  };

  useEffect(() => {
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  const content = (
    <span ref={setRef} className={cn("block w-full min-w-0 truncate", className)}>
      {text}
    </span>
  );

  if (!isTruncated) return content;

  return (
    <AppTooltip content={text} {...tooltipProps}>
      {content}
    </AppTooltip>
  );
}
