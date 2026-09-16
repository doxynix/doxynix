// @vitest-environment jsdom

import type { RefObject } from "react";
import { fireEvent, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useClickOutside } from "./use-click-outside";

describe("shared/lib/hooks:useClickOutside", () => {
  it("calls the callback when clicking outside the ref", () => {
    const callback = vi.fn();
    const ref = { current: null } as RefObject<HTMLDivElement | null>;

    renderHook(() => useClickOutside(ref, callback));

    const inside = document.createElement("div");
    document.body.append(inside);
    ref.current = inside;

    fireEvent.mouseDown(document.body);
    expect(callback).toHaveBeenCalledTimes(1);

    fireEvent.mouseDown(inside);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("also listens to touch events", () => {
    const callback = vi.fn();
    const ref = { current: null } as RefObject<HTMLDivElement | null>;

    const { unmount } = renderHook(() => useClickOutside(ref, callback));

    const inside = document.createElement("div");
    document.body.append(inside);
    ref.current = inside;

    fireEvent.touchStart(document.body);
    expect(callback).toHaveBeenCalledTimes(1);

    unmount();
    fireEvent.touchStart(document.body);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the ref is not attached", () => {
    const callback = vi.fn();
    const ref = { current: null } as RefObject<HTMLDivElement | null>;

    renderHook(() => useClickOutside(ref, callback));

    fireEvent.mouseDown(document.body);
    expect(callback).not.toHaveBeenCalled();
  });

  it("stops listening when disabled", () => {
    const callback = vi.fn();
    const ref = { current: null } as RefObject<HTMLDivElement | null>;

    const { rerender } = renderHook(({ enabled }) => useClickOutside(ref, callback, enabled), {
      initialProps: { enabled: true },
    });

    const inside = document.createElement("div");
    document.body.append(inside);
    ref.current = inside;

    rerender({ enabled: false });
    fireEvent.mouseDown(document.body);
    expect(callback).not.toHaveBeenCalled();
  });
});
