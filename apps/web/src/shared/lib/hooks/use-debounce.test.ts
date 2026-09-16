// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDebounce } from "./use-debounce";

describe("shared/lib/hooks:useDebounce", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("initial"));
    expect(result.current).toBe("initial");
  });

  it("does not update before the delay elapses", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { delay: 500, value: "a" },
    });

    rerender({ delay: 500, value: "b" });

    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(result.current).toBe("a");
  });

  it("updates after the delay", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { delay: 500, value: "a" },
    });

    rerender({ delay: 500, value: "b" });

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe("b");
  });

  it("only applies the latest value when re-rendered within the delay", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { delay: 500, value: "a" },
    });

    rerender({ delay: 500, value: "b" });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    rerender({ delay: 500, value: "c" });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe("c");
  });

  it("clears the pending timer on unmount", () => {
    vi.useFakeTimers();
    const { result, rerender, unmount } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { delay: 500, value: "a" } },
    );

    rerender({ delay: 500, value: "b" });
    unmount();
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe("a");
  });
});
