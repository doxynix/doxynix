"use client";

import {
  useEffect,
  useRef,
  type ChangeEvent,
  type ComponentProps,
  type Ref,
  type RefObject,
} from "react";

import { cn } from "@/shared/lib/cn";

import { Textarea } from "../core/textarea";

type Props = ComponentProps<typeof Textarea> & {
  maxHeight?: number;
  minHeight?: number;
  ref?: Ref<HTMLTextAreaElement>;
};

const adjustHeight = (
  ref: RefObject<HTMLTextAreaElement | null>,
  maxHeight: number,
  minHeight: number
) => {
  const textarea = ref.current;
  if (!textarea) return;

  textarea.style.height = "auto";
  const scrollHeight = textarea.scrollHeight;
  const newHeight = Math.min(scrollHeight, maxHeight);
  textarea.style.height = `${Math.max(newHeight, minHeight)}px`;
  textarea.style.overflowY = scrollHeight > maxHeight ? "auto" : "hidden";
};

export function AutosizeTextarea({
  className,
  maxHeight = 180,
  minHeight = 44,
  onChange,
  ref,
  ...props
}: Readonly<Props>) {
  const localRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!ref) return;

    if (typeof ref === "function") {
      ref(localRef.current);
    } else {
      (ref as { current: HTMLTextAreaElement | null }).current = localRef.current;
    }
  }, [ref]);

  useEffect(() => {
    adjustHeight(localRef, maxHeight, minHeight);
  }, [props.value, maxHeight, minHeight]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    adjustHeight(localRef, maxHeight, minHeight);
    onChange?.(e);
  };

  return (
    <Textarea
      ref={localRef}
      onChange={handleChange}
      className={cn("min-h-0 resize-none", className)}
      style={{
        maxHeight: `${maxHeight}px`,
        minHeight: `${minHeight}px`,
      }}
      {...props}
    />
  );
}
