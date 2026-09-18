import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/i18n/navigation", () => ({
  useRouter: vi.fn(),
}));

import { processNavigationSequence, resolveNavigationRoute } from "./use-navigation-hotkeys";

describe("resolveNavigationRoute", () => {
  it("should map every valid g-prefix second key to its correct route string", () => {
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
    const result = processNavigationSequence("g", "KeyZ");

    expect(result).toEqual({ action: "reset" });
  });

  it("should return reset action if second input is non-alphabetic", () => {
    const result = processNavigationSequence("g", "Digit2");

    expect(result).toEqual({ action: "reset" });
  });
});
