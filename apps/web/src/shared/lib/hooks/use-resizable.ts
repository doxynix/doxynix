"use client";

import type { KeyboardEvent, PointerEvent } from "react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type UseResizableOptions = {
  /** Width used on first render and by the double-click reset. */
  defaultWidth?: number;
  initialWidth?: number;
  maxWidth?: number;
  minWidth?: number;
  /** Called with the final clamped width when a pointer drag ends. */
  onDragEnd?: (width: number, didMove: boolean) => void;
  /** Viewport edge the panel is anchored to. */
  side?: "left" | "right";
  /** localStorage key. Omit to disable persistence. */
  storageKey?: string;
};

const KEYBOARD_STEP = 16;

const noopSubscribe = () => () => {};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function readWidth(storageKey: string | undefined, fallback: number, min: number, max: number) {
  const raw = storageKey === undefined ? null : localStorage.getItem(storageKey);
  const stored = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(stored) ? clamp(stored, min, max) : clamp(fallback, min, max);
}

/**
 * Drag-to-resize state for a fixed panel anchored to the left or right viewport
 * edge, with an optional localStorage-persisted width.
 *
 */
export function useResizable({
  defaultWidth = 256,
  initialWidth,
  maxWidth = 480,
  minWidth = 200,
  onDragEnd,
  side = "left",
  storageKey,
}: UseResizableOptions = {}) {
  const [liveWidth, setLiveWidth] = useState<null | number>(null);
  const [isResizing, setIsResizing] = useState(false);

  const frameRef = useRef<number | null>(null);
  const pointerXRef = useRef(0);
  const lastWidthRef = useRef(defaultWidth);
  const originRef = useRef({ startWidth: defaultWidth, startX: 0 });

  const getPersistedWidth = () =>
    readWidth(storageKey, initialWidth ?? defaultWidth, minWidth, maxWidth);
  const getServerWidth = () => clamp(initialWidth ?? defaultWidth, minWidth, maxWidth);

  const width = useSyncExternalStore(noopSubscribe, getPersistedWidth, getServerWidth);
  const currentWidth = liveWidth ?? width;

  const applyWidth = (next: number) => {
    const clamped = clamp(next, minWidth, maxWidth);
    lastWidthRef.current = clamped;
    setLiveWidth(clamped);
    return clamped;
  };

  const onDragEndRef = useRef(onDragEnd);
  useEffect(() => {
    onDragEndRef.current = onDragEnd;
  }, [onDragEnd]);

  useEffect(() => {
    if (!storageKey || isResizing || liveWidth === null) {
      return;
    }

    localStorage.setItem(storageKey, String(liveWidth));
  }, [isResizing, liveWidth, storageKey]);

  useEffect(() => {
    if (!isResizing) {
      return;
    }

    const body = document.body;
    const previousCursor = body.style.cursor;
    const previousUserSelect = body.style.userSelect;
    body.style.cursor = "col-resize";
    body.style.userSelect = "none";

    const update = () => {
      const delta = pointerXRef.current - originRef.current.startX;
      const clamped = clamp(
        originRef.current.startWidth + (side === "left" ? delta : -delta),
        minWidth,
        maxWidth,
      );
      lastWidthRef.current = clamped;
      setLiveWidth(clamped);
      return clamped;
    };

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      pointerXRef.current = event.clientX;
      if (frameRef.current !== null) {
        return;
      }

      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        update();
      });
    };

    const stop = () => {
      let finalWidth = lastWidthRef.current;

      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
        finalWidth = update();
      }

      body.style.cursor = previousCursor;
      body.style.userSelect = previousUserSelect;
      setIsResizing(false);
      onDragEndRef.current?.(finalWidth, pointerXRef.current !== originRef.current.startX);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointercancel", stop);
    window.addEventListener("pointerup", stop);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointercancel", stop);
      window.removeEventListener("pointerup", stop);
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = null;
      body.style.cursor = previousCursor;
      body.style.userSelect = previousUserSelect;
    };
  }, [isResizing, maxWidth, minWidth, side]);

  const startResizing = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    pointerXRef.current = event.clientX;
    lastWidthRef.current = currentWidth;
    originRef.current = { startWidth: currentWidth, startX: event.clientX };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsResizing(true);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const grow = side === "left" ? "ArrowRight" : "ArrowLeft";
    const shrink = side === "left" ? "ArrowLeft" : "ArrowRight";

    if (event.key === grow) {
      applyWidth(currentWidth + KEYBOARD_STEP);
    } else if (event.key === shrink) {
      applyWidth(currentWidth - KEYBOARD_STEP);
    } else if (event.key === "Home") {
      applyWidth(minWidth);
    } else if (event.key === "End") {
      applyWidth(maxWidth);
    } else {
      return;
    }

    event.preventDefault();
  };

  const resetWidth = () => {
    if (!isResizing) {
      applyWidth(defaultWidth);
    }
  };

  return {
    handleProps: {
      "aria-orientation": "vertical" as const,
      "aria-valuemax": maxWidth,
      "aria-valuemin": minWidth,
      "aria-valuenow": Math.round(currentWidth),
      onDoubleClick: resetWidth,
      onKeyDown: handleKeyDown,
      onPointerDown: startResizing,
      role: "separator" as const,
      tabIndex: 0,
    },
    isResizing,
    setWidth: applyWidth,
    width: Math.round(currentWidth),
  };
}
