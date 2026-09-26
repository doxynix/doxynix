// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSpinDelay } from "./use-spin-delay";

describe("useSpinDelay hook", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false initially when loading is false", () => {
    const { result } = renderHook(() => useSpinDelay(false));
    expect(result.current).toBe(false);
  });

  it("does not show spinner if loading finishes before delay (e.g. fast network request)", () => {
    const { result, rerender } = renderHook(
      ({ loading }) => useSpinDelay(loading, { delay: 150, minDuration: 300 }),
      { initialProps: { loading: true } },
    );

    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe(false);

    rerender({ loading: false });

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe(false);
  });

  it("shows spinner after delay threshold has passed for slower requests", () => {
    const { result } = renderHook(() => useSpinDelay(true, { delay: 150, minDuration: 300 }));

    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(result.current).toBe(true);
  });

  it("keeps spinner visible for minDuration to prevent UI flickering", () => {
    const { result, rerender } = renderHook(
      ({ loading }) => useSpinDelay(loading, { delay: 150, minDuration: 300 }),
      { initialProps: { loading: true } },
    );

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(50);
    });
    rerender({ loading: false });

    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toBe(false);
  });

  it("shows spinner immediately when delay is 0 or negative", () => {
    const { result } = renderHook(() => useSpinDelay(true, { delay: 0, minDuration: 200 }));

    expect(result.current).toBe(true);
  });

  it("cleans up active timers on unmount without throwing errors", () => {
    const { unmount } = renderHook(() => useSpinDelay(true, { delay: 150, minDuration: 300 }));

    expect(() => unmount()).not.toThrow();

    act(() => {
      vi.advanceTimersByTime(500);
    });
  });
});
