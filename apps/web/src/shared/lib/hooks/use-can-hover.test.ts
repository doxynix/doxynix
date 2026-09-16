// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useCanHover } from "./use-can-hover";

function stubMatchMedia(matches: boolean) {
  const mql = {
    addEventListener: vi.fn(),
    matches,
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => mql),
  );
  return mql;
}

describe("shared/lib/hooks:useCanHover", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true when the device supports hover", () => {
    stubMatchMedia(true);

    const { result } = renderHook(() => useCanHover());
    expect(result.current).toBe(true);
  });

  it("returns false when the device does not support hover", () => {
    stubMatchMedia(false);

    const { result } = renderHook(() => useCanHover());
    expect(result.current).toBe(false);
  });

  it("subscribes to media query changes and unsubscribes on unmount", () => {
    const mql = stubMatchMedia(true);

    const { unmount } = renderHook(() => useCanHover());

    expect(mql.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));

    unmount();
    expect(mql.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});
