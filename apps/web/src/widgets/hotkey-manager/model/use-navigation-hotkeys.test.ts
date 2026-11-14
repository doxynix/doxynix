import { describe, expect, it, vi } from "vitest";

import { commandMenuItems } from "@/shared/config/navigation";

vi.mock("@/shared/i18n/navigation", () => ({
  useRouter: vi.fn(),
}));

import { processNavigationSequence, resolveNavigationRoute } from "./use-navigation-hotkeys";

describe("resolveNavigationRoute", () => {
  it("should map every displayed g-sequence to its menu href", () => {
    expect(commandMenuItems.length).toBeGreaterThan(0);

    for (const item of commandMenuItems) {
      if (item.href == null || item.shortcut == null) {
        continue;
      }
      if (!item.shortcut.startsWith("G then ")) {
        continue;
      }

      const key = item.shortcut.slice("G then ".length);
      expect(resolveNavigationRoute("g", `Key${key}`)).toBe(item.href);
    }

    expect(resolveNavigationRoute("g", "KeyO")).toBe("/dashboard");
  });

  it("should return null for unknown keys or invalid prefix structures", () => {
    expect(resolveNavigationRoute("g", "KeyX")).toBeNull();
    expect(resolveNavigationRoute("x", "KeyC")).toBeNull();
    expect(resolveNavigationRoute("g", "Digit1")).toBeNull();
  });
});

describe("processNavigationSequence", () => {
  it("should return ignore action when prefix is absent", () => {
    const result = processNavigationSequence(null, "KeyR");

    expect(result).toEqual({ action: "ignore" });
  });

  it("should return execute action with target path for valid sequence", () => {
    const result = processNavigationSequence("g", "KeyR");

    expect(result).toEqual({ action: "execute", path: "/dashboard/repos" });
  });

  it("should return reset action when second key is invalid or unrecognized", () => {
    const result = processNavigationSequence("g", "KeyX");

    expect(result).toEqual({ action: "reset" });
  });

  it("should resolve the danger-zone sequence", () => {
    expect(processNavigationSequence("g", "KeyZ")).toEqual({
      action: "execute",
      path: "/dashboard/settings/danger-zone",
    });
  });

  it("should return reset action if second input is non-alphabetic", () => {
    const result = processNavigationSequence("g", "Digit2");

    expect(result).toEqual({ action: "reset" });
  });
});
