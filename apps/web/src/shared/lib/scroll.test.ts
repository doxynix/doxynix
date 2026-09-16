import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { smoothScrollTo } from "@/shared/lib/scroll";

describe("shared/lib/utils:smoothScrollTo", () => {
  const scrollToMock = vi.fn();
  const matchMediaMock = vi.fn().mockReturnValue({ matches: false });

  beforeEach(() => {
    vi.stubGlobal("window", {
      history: {
        replaceState: vi.fn(),
      },
      matchMedia: matchMediaMock,
      pageYOffset: 0,
      scrollTo: scrollToMock,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should warn and stop when element is not found", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    vi.stubGlobal("document", {
      getElementById: vi.fn(() => null),
    });

    smoothScrollTo("missing-element");

    expect(warnSpy).toHaveBeenCalledWith("Element with id #missing-element not found");
    warnSpy.mockRestore();
  });

  it("should call scrollTo when target element exists", () => {
    const element = {
      getBoundingClientRect: vi.fn(() => ({ top: 300 })),
    };
    let currentTime = 0;

    vi.stubGlobal("document", {
      getElementById: vi.fn(() => element),
    });
    vi.stubGlobal("window", {
      history: {
        replaceState: vi.fn(),
      },
      matchMedia: matchMediaMock,
      pageYOffset: 100,
      scrollTo: scrollToMock,
    });
    vi.stubGlobal("requestAnimationFrame", (callback: (time: number) => void) => {
      currentTime += 400;
      callback(currentTime);
      return 1;
    });

    smoothScrollTo("target", 80, 800);

    expect(scrollToMock).toHaveBeenCalled();
  });
});
