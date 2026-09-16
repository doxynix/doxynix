// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useIsMobile } from "./use-mobile";

function stubMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    addEventListener: vi.fn((_event: string, callback: () => void) => {
      listeners.add(callback);
    }),
    matches,
    removeEventListener: vi.fn((_event: string, callback: () => void) => {
      listeners.delete(callback);
    }),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => mql),
  );
  return { listeners };
}

function setInnerWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width, writable: true });
}

describe("shared/lib/hooks:useIsMobile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false on desktop widths", () => {
    stubMatchMedia(false);
    setInnerWidth(1024);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("returns true below the 768px mobile breakpoint", () => {
    stubMatchMedia(false);
    setInnerWidth(767);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("responds to window resize changes via the subscription", () => {
    vi.useFakeTimers();
    const { listeners } = stubMatchMedia(false);
    setInnerWidth(1024);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    setInnerWidth(400);
    act(() => {
      for (const listener of listeners) {
        listener();
      }
    });

    expect(result.current).toBe(true);
  });
});
