// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockPush = vi.fn();
vi.mock("@/shared/i18n/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
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

import { resolveNavigationRoute, useNavigationHotkeys } from "./use-navigation-hotkeys";

describe("resolveNavigationRoute", () => {
  it("maps every g-prefix second key to its route", () => {
    expect(resolveNavigationRoute("g", "KeyC")).toBe("/dashboard/settings/connections");
    expect(resolveNavigationRoute("g", "KeyD")).toBe("/dashboard/settings/danger-zone");
    expect(resolveNavigationRoute("g", "KeyH")).toBe("/support");
    expect(resolveNavigationRoute("g", "KeyK")).toBe("/dashboard/settings/api-keys");
    expect(resolveNavigationRoute("g", "KeyL")).toBe("/dashboard/settings/audit-log");
    expect(resolveNavigationRoute("g", "KeyN")).toBe("/dashboard/notifications");
    expect(resolveNavigationRoute("g", "KeyO")).toBe("/dashboard");
    expect(resolveNavigationRoute("g", "KeyP")).toBe("/dashboard/settings/profile");
    expect(resolveNavigationRoute("g", "KeyR")).toBe("/dashboard/repos");
    expect(resolveNavigationRoute("g", "KeyS")).toBe("/dashboard/settings/profile");
  });

  it("returns null for unknown keys or invalid prefix", () => {
    expect(resolveNavigationRoute("g", "KeyX")).toBeNull();
    expect(resolveNavigationRoute("x", "KeyC")).toBeNull();
    expect(resolveNavigationRoute("g", "Digit1")).toBeNull();
  });
});

describe("useNavigationHotkeys hook", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    hotkeyMap.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("navigates to route when valid hotkey sequence is pressed", () => {
    const onAction = vi.fn();
    renderHook(() => useNavigationHotkeys(onAction));

    act(() => {
      hotkeyMap.get("g")?.({}, { hotkey: "g" });
    });

    act(() => {
      hotkeyMap.get("*")?.({ code: "KeyR" });
    });

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/dashboard/repos");
  });

  it("resets prefix state if second key is not pressed within 1500ms", () => {
    renderHook(() => useNavigationHotkeys());

    act(() => {
      hotkeyMap.get("g")?.({}, { hotkey: "g" });
    });

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    act(() => {
      hotkeyMap.get("*")?.({ code: "KeyR" });
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("ignores unknown second key and resets prefix", () => {
    const onAction = vi.fn();
    renderHook(() => useNavigationHotkeys(onAction));

    act(() => {
      hotkeyMap.get("g")?.({}, { hotkey: "g" });
    });

    act(() => {
      hotkeyMap.get("*")?.({ code: "KeyZ" });
    });

    expect(onAction).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
