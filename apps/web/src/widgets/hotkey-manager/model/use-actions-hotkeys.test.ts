// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockSetOpen = vi.fn();
vi.mock("@/entities/repo/model/use-create-repo-dialog.store", () => ({
  useCreateRepoActions: () => ({ setOpen: mockSetOpen }),
}));

const hotkeyMap = new Map<string, (e: any, handler?: any) => void>();
vi.mock("react-hotkeys-hook", () => ({
  useHotkeys: vi.fn((keys: string, callback: any, options?: any) => {
    if (options?.enabled !== false) {
      hotkeyMap.set(keys, callback);
    } else {
      hotkeyMap.delete(keys);
    }
  }),
}));

import { resolveGlobalHotkeyCommand, useGlobalActionsHotkeys } from "./use-actions-hotkeys";

describe("resolveGlobalHotkeyCommand", () => {
  it("maps the c+r sequence to createRepo", () => {
    expect(resolveGlobalHotkeyCommand("c", "KeyR")).toBe("createRepo");
  });

  it("returns null for unknown keys or invalid prefix", () => {
    expect(resolveGlobalHotkeyCommand("c", "KeyX")).toBeNull();
    expect(resolveGlobalHotkeyCommand("x", "KeyR")).toBeNull();
    expect(resolveGlobalHotkeyCommand("c", "Digit1")).toBeNull();
  });
});

describe("useGlobalActionsHotkeys hook", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    hotkeyMap.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens create repo dialog when c + r sequence is pressed", () => {
    const onAction = vi.fn();
    const stopPropagation = vi.fn();
    renderHook(() => useGlobalActionsHotkeys(onAction));

    act(() => {
      hotkeyMap.get("c")?.({}, { hotkey: "c" });
    });

    act(() => {
      hotkeyMap.get("*")?.({ code: "KeyR", stopPropagation });
    });

    expect(stopPropagation).toHaveBeenCalled();
    expect(onAction).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(10);
    });

    expect(mockSetOpen).toHaveBeenCalledWith(true);
  });

  it("clears prefix on timeout without opening dialog", () => {
    renderHook(() => useGlobalActionsHotkeys());

    act(() => {
      hotkeyMap.get("c")?.({}, { hotkey: "c" });
    });

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    act(() => {
      hotkeyMap.get("*")?.({ code: "KeyR", stopPropagation: vi.fn() });
    });

    act(() => {
      vi.advanceTimersByTime(10);
    });

    expect(mockSetOpen).not.toHaveBeenCalled();
  });
});
