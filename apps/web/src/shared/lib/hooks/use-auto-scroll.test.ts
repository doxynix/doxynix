// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { isNearBottom, useAutoScroll } from "./use-auto-scroll";

describe("shared/lib/hooks:isNearBottom", () => {
  it("detects when the scroll position is within 15px of the bottom", () => {
    expect(isNearBottom(500, 0, 400)).toBe(false);
    expect(isNearBottom(500, 480, 20)).toBe(true);
    expect(isNearBottom(500, 491, 10)).toBe(true);
    expect(isNearBottom(1000, 900, 85)).toBe(false);
    expect(isNearBottom(1000, 901, 85)).toBe(true);
  });
});

describe("shared/lib/hooks:useAutoScroll", () => {
  it("scrolls the matched viewport to the bottom", () => {
    const { result } = renderHook(() => useAutoScroll<HTMLDivElement>([]));

    const root = document.createElement("div");
    const viewport = document.createElement("div");
    viewport.setAttribute("data-radix-scroll-area-viewport", "");
    root.append(viewport);

    const scrollTo = vi.fn();
    viewport.scrollTo = scrollTo;

    act(() => {
      result.current.scrollRef.current = root;
    });

    act(() => {
      result.current.scrollToBottom();
    });

    expect(scrollTo).toHaveBeenCalledWith({
      behavior: "smooth",
      top: viewport.scrollHeight,
    });
  });

  it("passes the requested scroll behavior through", () => {
    const { result } = renderHook(() => useAutoScroll<HTMLDivElement>([]));

    const root = document.createElement("div");
    const viewport = document.createElement("div");
    viewport.setAttribute("data-radix-scroll-area-viewport", "");
    root.append(viewport);

    const scrollTo = vi.fn();
    viewport.scrollTo = scrollTo;

    act(() => {
      result.current.scrollRef.current = root;
    });

    act(() => {
      result.current.scrollToBottom("auto");
    });

    expect(scrollTo).toHaveBeenCalledWith({
      behavior: "auto",
      top: viewport.scrollHeight,
    });
  });

  it("no-ops when no viewport container is attached", () => {
    const { result } = renderHook(() => useAutoScroll<HTMLDivElement>([]));

    expect(() => {
      act(() => {
        result.current.scrollToBottom();
      });
    }).not.toThrow();
  });
});
