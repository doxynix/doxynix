// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveMapCommand, useRepoMapHotkeys } from "./use-repo-map-hotkeys";

const mockToggleControls = vi.fn();
const mockFitView = vi.fn();
const mockFocusSelected = vi.fn();
const mockZoomIn = vi.fn();
const mockZoomOut = vi.fn();

vi.mock("./use-repo-map.store", () => ({
  useMapControlsActions: () => ({ toggleControls: mockToggleControls }),
}));

vi.mock("./use-map-commands", () => ({
  useMapCommands: () => ({
    fitView: mockFitView,
    focusSelected: mockFocusSelected,
    zoomIn: mockZoomIn,
    zoomOut: mockZoomOut,
  }),
}));

type HotkeyCallback = (e: KeyboardEvent, handler: { hotkey: string }) => void;
const hotkeyHandlers: { [key: string]: HotkeyCallback } = {};

vi.mock("react-hotkeys-hook", () => ({
  useHotkeys: vi.fn((keys: string, callback: HotkeyCallback, options: { enabled?: boolean }) => {
    if (options.enabled !== false) {
      hotkeyHandlers[keys] = callback;
    }
  }),
}));

describe("resolveMapCommand", () => {
  it("правильно резолвит команды по префиксу и коду клавиши", () => {
    expect(resolveMapCommand("f", "KeyS")).toBe("focusSelected");
    expect(resolveMapCommand("f", "KeyV")).toBe("fitView");
    expect(resolveMapCommand("t", "KeyC")).toBe("toggleControls");
    expect(resolveMapCommand("z", "KeyI")).toBe("zoomIn");
    expect(resolveMapCommand("z", "KeyO")).toBe("zoomOut");
  });

  it("возвращает null для неподдерживаемых комбинаций и клавиш", () => {
    expect(resolveMapCommand("f", "KeyX")).toBeNull();
    expect(resolveMapCommand("unknown", "KeyS")).toBeNull();
    expect(resolveMapCommand("f", "Enter")).toBeNull();
  });
});

describe("useRepoMapHotkeys", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("инициализирует хук без ошибок", () => {
    expect(() => renderHook(() => useRepoMapHotkeys())).not.toThrow();
  });
});
