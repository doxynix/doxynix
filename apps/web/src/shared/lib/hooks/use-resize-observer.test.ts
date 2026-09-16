// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useResizeObserver } from "./use-resize-observer";

class ResizeObserverMock {
  static instances: ResizeObserverMock[] = [];

  callback: ResizeObserverCallback;

  disconnect = vi.fn();

  observe = vi.fn();

  unobserve = vi.fn();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    ResizeObserverMock.instances.push(this);
  }
}

function fireResize(observer: ResizeObserverMock, width: number, height: number) {
  const entry = {
    contentRect: { height, width },
  } as ResizeObserverEntry;

  act(() => {
    observer.callback([entry], observer);
  });
}

describe("shared/lib/hooks:useResizeObserver", () => {
  afterEach(() => {
    ResizeObserverMock.instances = [];
    vi.unstubAllGlobals();
  });

  it("reports the observed element size", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    const { result } = renderHook(() => useResizeObserver<HTMLDivElement>());
    const element = document.createElement("div");

    act(() => {
      result.current[0](element);
    });

    const observer = ResizeObserverMock.instances[0]!;
    expect(observer.observe).toHaveBeenCalledWith(element);

    fireResize(observer, 100, 50);
    expect(result.current[1]).toEqual({ height: 50, width: 100 });
  });

  it("keeps the previous size reference when dimensions are unchanged", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    const { result } = renderHook(() => useResizeObserver<HTMLDivElement>());
    const element = document.createElement("div");

    act(() => {
      result.current[0](element);
    });

    const observer = ResizeObserverMock.instances[0]!;
    fireResize(observer, 100, 50);
    const sizeBefore = result.current[1];

    fireResize(observer, 100, 50);
    expect(result.current[1]).toBe(sizeBefore);

    fireResize(observer, 120, 70);
    expect(result.current[1]).toEqual({ height: 70, width: 120 });
  });

  it("detaches the observer when the ref is released", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    const { result } = renderHook(() => useResizeObserver<HTMLDivElement>());
    const element = document.createElement("div");

    let detach: () => void = () => {};
    act(() => {
      detach = result.current[0](element);
    });

    const observer = ResizeObserverMock.instances[0]!;
    expect(observer.disconnect).not.toHaveBeenCalled();

    act(() => {
      detach();
    });
    expect(observer.disconnect).toHaveBeenCalled();

    act(() => {
      result.current[0](null);
    });
  });
});
