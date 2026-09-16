// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { nextTypingLength, useTypewriter } from "./use-typewriter";

describe("shared/lib/hooks:nextTypingLength", () => {
  it("advances one plain character at a time", () => {
    expect(nextTypingLength("abc", 0)).toBe(1);
    expect(nextTypingLength("abc", 1)).toBe(2);
    expect(nextTypingLength("hello", 1)).toBe(2);
  });

  it("skips a whole tag plus one character in a single tick", () => {
    expect(nextTypingLength("<b>hi", 0)).toBe(4);
  });

  it("skips a whole HTML entity plus the following character", () => {
    expect(nextTypingLength("&amp;x", 0)).toBe(6);
  });

  it("does not fast-forward long or dangling entities", () => {
    expect(nextTypingLength("&abcdefghijkl;z", 0)).toBe(2);
    expect(nextTypingLength("< ", 0)).toBe(2);
  });

  it("chains consecutive tags and entities in one tick", () => {
    expect(nextTypingLength("<b>&amp;</b>", 0)).toBe(12);
  });
});

describe("shared/lib/hooks:useTypewriter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("types one character per interval and stops at the end", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTypewriter("hi", 10));

    act(() => {
      vi.advanceTimersByTime(9);
    });
    expect(result.current).toBe("");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("h");

    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(result.current).toBe("hi");

    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(result.current).toBe("hi");
  });

  it("renders tags as complete units instead of char-by-char", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTypewriter("<b>hi</b>", 10));

    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(result.current).toBe("<b>h");

    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(result.current).toBe("<b>hi");

    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(result.current).toBe("<b>hi</b>");
  });

  it("resets the displayed text when the target changes", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ text }) => useTypewriter(text, 10), {
      initialProps: { text: "hello" },
    });

    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(result.current).toBe("he");

    rerender({ text: "world" });
    expect(result.current).toBe("");

    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(result.current).toBe("w");
  });

  it("does nothing for whitespace-only targets", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTypewriter("   ", 10));

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe("");
  });
});
