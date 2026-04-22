"use client";

import * as React from "react";
import { useEffect } from "react";

import { cn } from "@/shared/lib/cn";

import { Spinner } from "./spinner";

export interface ZoomPanProps {
  children?: React.ReactNode;
  className?: string;
  controls?: (api: {
    centerView: () => void;
    resetZoom: () => void;
    scalePercent: number;
    zoomIn: () => void;
    zoomOut: () => void;
  }) => React.ReactNode;
  imageSrc?: string;
  initialScale?: number;
  isLoading?: boolean;
  loadingFallback?: React.ReactNode;
  maxScale?: number;
  minScale?: number;
  onLoad?: () => void;
  zoomStep?: number;
}

export function ZoomPan({
  children,
  className = "",
  controls,
  imageSrc,
  initialScale = 1,
  isLoading = false,
  loadingFallback,
  maxScale = 5,
  minScale = 0.1,
  onLoad,
  zoomStep = 0.1,
}: Readonly<ZoomPanProps>) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const imageRef = React.useRef<HTMLImageElement | null>(null);

  // Transform refs
  const currentRef = React.useRef({ scale: initialScale, x: 0, y: 0 });
  const targetRef = React.useRef({ scale: initialScale, x: 0, y: 0 });

  // UI state for controls
  const [scalePercent, setScalePercent] = React.useState(Math.round(initialScale * 100));

  // Interaction refs
  const isDragging = React.useRef(false);
  const isPinching = React.useRef(false);
  const panStartRef = React.useRef({ x: 0, y: 0 });
  const targetStartRef = React.useRef({ x: 0, y: 0 });

  // Animation/Raf ref
  const rafRef = React.useRef<null | number>(null);
  const hasCentered = React.useRef(false);

  // Touch refs
  const touchStartRef = React.useRef<null | {
    center: { x: number; y: number };
    distance: number;
    scale: number;
    touches: Array<{ x: number; y: number }>;
    translateX: number;
    translateY: number;
  }>(null);

  const getTouchDistance = (touches: React.TouchList | TouchList) => {
    if (touches.length < 2) return 0;
    const touch0 = touches[0]!;
    const touch1 = touches[1]!;
    const dx = touch0.clientX - touch1.clientX;
    const dy = touch0.clientY - touch1.clientY;
    return Math.hypot(dx, dy);
  };

  const getTouchCenter = (touches: React.TouchList | TouchList) => {
    if (touches.length < 2) return { x: touches[0]?.clientX || 0, y: touches[0]?.clientY || 0 };
    const touch0 = touches[0]!;
    const touch1 = touches[1]!;
    return {
      x: (touch0.clientX + touch1.clientX) / 2,
      y: (touch0.clientY + touch1.clientY) / 2,
    };
  };

  // Render canvas
  const render = React.useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { scale, x, y } = currentRef.current;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Draw image
    ctx.drawImage(image, 0, 0, image.width, image.height);

    ctx.restore();
  }, []);

  // Mode 1: Snappy Update (Instant)
  // Used for drag, pinch, and wheel to ensure 1:1 input response
  const updateImmediate = React.useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    rafRef.current = requestAnimationFrame(() => {
      // Direct 1:1 sync with target
      currentRef.current.x = targetRef.current.x;
      currentRef.current.y = targetRef.current.y;
      currentRef.current.scale = targetRef.current.scale;

      render();

      const newPercent = Math.round(currentRef.current.scale * 100);
      setScalePercent((prev) => {
        if (prev !== newPercent) return newPercent;
        return prev;
      });

      rafRef.current = null;
    });
  }, [render]);

  // Mode 2: Smooth Update (Interpolated)
  // Used for buttons (zoom in/out, reset, center) to provide a nice feel
  const updateSmooth = React.useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const loop = () => {
      const target = targetRef.current;
      const current = currentRef.current;

      const lerp = 0.3; // Smoothing factor (higher = faster/snappier)
      const dist_x = target.x - current.x;
      const dist_y = target.y - current.y;
      const dist_s = target.scale - current.scale;

      // Stop condition: close enough to target
      if (Math.abs(dist_x) < 0.5 && Math.abs(dist_y) < 0.5 && Math.abs(dist_s) < 0.001) {
        current.x = target.x;
        current.y = target.y;
        current.scale = target.scale;
        render();
        setScalePercent(Math.round(current.scale * 100));
        rafRef.current = null;
        return;
      }

      // Interpolate
      current.x += dist_x * lerp;
      current.y += dist_y * lerp;
      current.scale += dist_s * lerp;

      render();
      setScalePercent(Math.round(current.scale * 100));
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  }, [render]);

  // Clean up RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // Logic functions for API
  const applyZoom = React.useCallback(
    (delta: number) => {
      const target = targetRef.current;
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const newScale = Math.min(maxScale, Math.max(minScale, target.scale + delta));
      const ratio = newScale / target.scale;

      target.x = centerX - (centerX - target.x) * ratio;
      target.y = centerY - (centerY - target.y) * ratio;
      target.scale = newScale;

      updateSmooth();
    },
    [maxScale, minScale, updateSmooth]
  );

  const zoomIn = React.useCallback(() => applyZoom(zoomStep), [applyZoom, zoomStep]);
  const zoomOut = React.useCallback(() => applyZoom(-zoomStep), [applyZoom, zoomStep]);

  const resetZoom = React.useCallback(() => {
    targetRef.current = { scale: initialScale, x: 0, y: 0 };
    updateSmooth();
  }, [initialScale, updateSmooth]);

  // Shared calculation for centering without applying it yet
  const getCenterTransform = React.useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return null;

    const scaleX = canvas.clientWidth / image.width;
    const scaleY = canvas.clientHeight / image.height;
    const scale = Math.min(scaleX, scaleY) * 0.9;

    const x = (canvas.clientWidth - image.width * scale) / 2;
    const y = (canvas.clientHeight - image.height * scale) / 2;

    return { scale, x, y };
  }, []);

  const centerView = React.useCallback(() => {
    const center = getCenterTransform();
    if (!center) return;
    targetRef.current = center;
    updateSmooth();
  }, [getCenterTransform, updateSmooth]);

  const [api, setApi] = React.useState<null | {
    centerView: () => void;
    resetZoom: () => void;
    scalePercent: number;
    zoomIn: () => void;
    zoomOut: () => void;
  }>(null);

  useEffect(() => {
    setApi({
      centerView,
      resetZoom,
      scalePercent,
      zoomIn,
      zoomOut,
    });
  }, [zoomIn, zoomOut, resetZoom, centerView, scalePercent]);

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    isDragging.current = true;

    // Sync logic: grab exactly where we are, cancelling any smooth animation
    targetRef.current = { ...currentRef.current };
    panStartRef.current = { x: e.clientX, y: e.clientY };
    targetStartRef.current = { ...targetRef.current };

    updateImmediate();
  };

  // Setup non-passive wheel event listener
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 40;
      const ZOOM_SENSITIVITY = 0.0015;
      const scaleFactor = Math.exp(-delta * ZOOM_SENSITIVITY);

      const current = currentRef.current;
      const target = targetRef.current;

      const effectiveScale = Math.min(maxScale, Math.max(minScale, current.scale * scaleFactor));
      const ratio = effectiveScale / current.scale;

      target.x = mouseX - (mouseX - current.x) * ratio;
      target.y = mouseY - (mouseY - current.y) * ratio;
      target.scale = effectiveScale;

      updateImmediate();
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [maxScale, minScale, updateImmediate]);

  // Window events for dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;

      targetRef.current.x = targetStartRef.current.x + dx;
      targetRef.current.y = targetStartRef.current.y + dy;

      updateImmediate();
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [updateImmediate]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    // Sync current state to target to stop any smooth animation instantly
    targetRef.current = { ...currentRef.current };

    if (e.touches.length === 1) {
      const touch0 = e.touches[0];
      if (touch0 != null) {
        isDragging.current = true;
        touchStartRef.current = {
          center: { x: 0, y: 0 },
          distance: 0,
          scale: currentRef.current.scale,
          touches: [{ x: touch0.clientX, y: touch0.clientY }],
          translateX: currentRef.current.x,
          translateY: currentRef.current.y,
        };
      }
    } else if (e.touches.length === 2) {
      const touch0 = e.touches[0];
      const touch1 = e.touches[1];
      if (touch0 != null && touch1 != null) {
        isPinching.current = true;
        isDragging.current = false;

        touchStartRef.current = {
          center: getTouchCenter(e.touches),
          distance: getTouchDistance(e.touches),
          scale: currentRef.current.scale,
          touches: [
            { x: touch0.clientX, y: touch0.clientY },
            { x: touch1.clientX, y: touch1.clientY },
          ],
          translateX: currentRef.current.x,
          translateY: currentRef.current.y,
        };
      }
    }
    updateImmediate();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.cancelable) e.preventDefault();
    if (!touchStartRef.current) return;

    if (e.touches.length === 1 && isDragging.current) {
      const touch0 = e.touches[0];
      const startTouch = touchStartRef.current.touches[0];
      if (touch0 && startTouch) {
        const dx = touch0.clientX - startTouch.x;
        const dy = touch0.clientY - startTouch.y;

        targetRef.current.x = touchStartRef.current.translateX + dx;
        targetRef.current.y = touchStartRef.current.translateY + dy;
      }
    } else if (e.touches.length === 2) {
      const newDist = getTouchDistance(e.touches);
      const newCenter = getTouchCenter(e.touches);
      const rect = canvasRef.current?.getBoundingClientRect() || {
        left: 0,
        top: 0,
      };

      const scaleRatio = newDist / touchStartRef.current.distance;
      const newScale = Math.min(
        maxScale,
        Math.max(minScale, touchStartRef.current.scale * scaleRatio)
      );

      const oldScale = touchStartRef.current.scale;
      const oldX = touchStartRef.current.translateX;

      const oldCenterRelX = touchStartRef.current.center.x - rect.left;
      const oldCenterRelY = touchStartRef.current.center.y - rect.top;

      const contentX = (oldCenterRelX - oldX) / oldScale;
      const contentY = (oldCenterRelY - touchStartRef.current.translateY) / oldScale;

      const newCenterRelX = newCenter.x - rect.left;
      const newCenterRelY = newCenter.y - rect.top;

      targetRef.current.scale = newScale;
      targetRef.current.x = newCenterRelX - contentX * newScale;
      targetRef.current.y = newCenterRelY - contentY * newScale;
    }

    updateImmediate();
  };

  // ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      const { height, width } = entry.contentRect;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      // Perform initial centering if we haven't yet and we have a valid size
      // and an image is already loaded.
      if (!hasCentered.current && imageRef.current && width > 0 && height > 0) {
        const center = getCenterTransform();
        if (center) {
          targetRef.current = center;
          currentRef.current = center;
          hasCentered.current = true;
        }
      }

      render();
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [render, getCenterTransform]);

  // Image loading logic
  useEffect(() => {
    if (!imageSrc) {
      imageRef.current = null;
      hasCentered.current = false;
      render();
      return;
    }

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      imageRef.current = image;

      // Calculate center for initial display
      // We manually implement "snap to center" here to avoid animation on load
      const canvas = canvasRef.current;
      if (canvas && canvas.clientWidth > 0 && canvas.clientHeight > 0) {
        const scaleX = canvas.clientWidth / image.width;
        const scaleY = canvas.clientHeight / image.height;
        const scale = Math.min(scaleX, scaleY) * 0.9;

        const x = (canvas.clientWidth - image.width * scale) / 2;
        const y = (canvas.clientHeight - image.height * scale) / 2;

        const center = { scale, x, y };
        targetRef.current = center;
        currentRef.current = center;
        hasCentered.current = true;
      }

      render();
      onLoad?.();
    };
    image.src = imageSrc;
  }, [imageSrc, onLoad, render, getCenterTransform]);

  return (
    <div ref={containerRef} className={cn("flex h-full min-h-0 w-full flex-col", className)}>
      {controls && api && controls(api)}

      <div className="relative min-h-0 flex-1 cursor-grab touch-none overflow-hidden select-none active:cursor-grabbing">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onTouchEnd={() => {
            isDragging.current = false;
            isPinching.current = false;
          }}
          onTouchMove={handleTouchMove}
          // onWheel handled via useEffect with passive: false
          onTouchStart={handleTouchStart}
          className="block h-full w-full touch-none"
        />

        <div className="pointer-events-none absolute inset-0 -z-50 overflow-hidden opacity-0">
          {children}
        </div>

        {isLoading && (
          <div className="bg-background/50 absolute inset-0 z-50 flex items-center justify-center">
            {loadingFallback || <Spinner />}
          </div>
        )}
      </div>
    </div>
  );
}
