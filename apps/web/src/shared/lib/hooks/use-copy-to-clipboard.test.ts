// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useCopyToClipboard } from "./use-copy-to-clipboard";

const { mockToastError } = vi.hoisted(() => ({ mockToastError: vi.fn() }));

vi.mock("sonner", () => ({
  toast: { error: mockToastError },
}));

function stubClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
}

describe("shared/lib/hooks:useCopyToClipboard", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "clipboard");
    mockToastError.mockClear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("writes to the clipboard and resets isCopied after the timeout", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);

    const { result } = renderHook(() => useCopyToClipboard(1000));

    await act(async () => {
      await result.current.copy("payload");
    });

    expect(writeText).toHaveBeenCalledWith("payload");
    expect(result.current.isCopied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.isCopied).toBe(false);
  });

  it("notifies when the Clipboard API is unavailable", async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy("payload");
    });

    expect(mockToastError).toHaveBeenCalledWith("Clipboard API not available");
    expect(result.current.isCopied).toBe(false);
  });

  it("reports and swallows clipboard write failures", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    stubClipboard(writeText);

    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy("payload");
    });

    expect(mockToastError).toHaveBeenCalledWith("Copy failed");
    expect(errorSpy).toHaveBeenCalled();
    expect(result.current.isCopied).toBe(false);
  });
});
