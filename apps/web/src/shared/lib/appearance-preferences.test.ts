// @vitest-environment jsdom
import { runInThisContext } from "node:vm";

import { beforeEach, describe, expect, it } from "vitest";

import {
  AppearanceInputSchema,
  AppearancePatchSchema,
  AppearancePreferencesSchema,
  appearanceBootstrapScript,
  applyAppearancePreferences,
  DEFAULT_APPEARANCE,
  readAppearancePreferences,
  STORAGE_KEY,
  subscribeCodeTheme,
  writeAppearancePreferences,
} from "./appearance-preferences";

const APPLIED_ATTRIBUTES = [
  "data-radius",
  "data-text-scale",
  "data-theme",
  "data-border-contrast",
  "data-reduce-motion",
  "data-pointer-cursor",
  "data-underline-links",
] as const;

function resetDocumentElement() {
  for (const attribute of APPLIED_ATTRIBUTES) {
    document.documentElement.removeAttribute(attribute);
  }

  document.documentElement.removeAttribute("style");
}

function runBootstrapScript() {
  runInThisContext(appearanceBootstrapScript());
}

describe("appearance preferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetDocumentElement();
  });

  it("falls back to defaults when storage is empty", () => {
    expect(readAppearancePreferences()).toEqual(DEFAULT_APPEARANCE);
  });

  it("ignores unknown values coming from storage", () => {
    window.localStorage.setItem(
      "doxynix-appearance",
      JSON.stringify({ accent: "neon", radius: 42, textScale: "huge" }),
    );

    expect(readAppearancePreferences()).toEqual(DEFAULT_APPEARANCE);
  });

  it("round-trips written preferences", () => {
    const preferences = {
      ...DEFAULT_APPEARANCE,
      radius: "soft" as const,
    };

    writeAppearancePreferences(preferences);

    expect(readAppearancePreferences()).toEqual(preferences);
  });

  it("applies radius, scale and motion to the document element", () => {
    applyAppearancePreferences({
      ...DEFAULT_APPEARANCE,
      pointerCursor: true,
      radius: "sharp",
      reduceMotion: true,
      textScale: "large",
      underlineLinks: true,
    });

    const root = document.documentElement;

    expect(root.getAttribute("data-radius")).toBe("sharp");
    expect(root.getAttribute("data-text-scale")).toBe("large");
    expect(root.hasAttribute("data-reduce-motion")).toBe(true);
    expect(root.hasAttribute("data-pointer-cursor")).toBe(true);
    expect(root.hasAttribute("data-underline-links")).toBe(true);
  });

  it("supports sidebar variants", () => {
    const preferences = {
      ...DEFAULT_APPEARANCE,
      sidebarVariant: "floating" as const,
    };

    writeAppearancePreferences(preferences);

    expect(readAppearancePreferences()).toEqual(preferences);
  });

  it("supports a collapsible sidebar mode", () => {
    const preferences = {
      ...DEFAULT_APPEARANCE,
      collapsible: "icon" as const,
    };

    writeAppearancePreferences(preferences);

    expect(readAppearancePreferences()).toEqual(preferences);
  });

  it("falls back to the default collapse mode for unknown values", () => {
    window.localStorage.setItem(
      "doxynix-appearance",
      JSON.stringify({ collapsible: "hidden", sidebarVariant: "glass" }),
    );

    const preferences = readAppearancePreferences();

    expect(preferences.collapsible).toBe(DEFAULT_APPEARANCE.collapsible);
    expect(preferences.sidebarVariant).toBe(DEFAULT_APPEARANCE.sidebarVariant);
  });

  it("removes behaviour toggles when they are off", () => {
    applyAppearancePreferences({
      ...DEFAULT_APPEARANCE,
      pointerCursor: true,
      underlineLinks: true,
    });
    applyAppearancePreferences({
      ...DEFAULT_APPEARANCE,
      pointerCursor: false,
      underlineLinks: false,
    });

    const root = document.documentElement;

    expect(root.hasAttribute("data-pointer-cursor")).toBe(false);
    expect(root.hasAttribute("data-underline-links")).toBe(false);
  });

  it("drops a legacy accent attribute", () => {
    document.documentElement.setAttribute("data-accent", "green");

    applyAppearancePreferences(DEFAULT_APPEARANCE);

    expect(document.documentElement.hasAttribute("data-accent")).toBe(false);
  });

  it("notifies code theme subscribers on write", () => {
    let calls = 0;
    const unsubscribe = subscribeCodeTheme(() => {
      calls += 1;
    });

    writeAppearancePreferences(DEFAULT_APPEARANCE);
    unsubscribe();
    writeAppearancePreferences(DEFAULT_APPEARANCE);

    expect(calls).toBe(1);
  });
});

describe("appearance bootstrap script", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetDocumentElement();
  });

  it("applies every default before hydration", () => {
    runBootstrapScript();

    const root = document.documentElement;

    expect(root.getAttribute("data-radius")).toBe(DEFAULT_APPEARANCE.radius);
    expect(root.getAttribute("data-text-scale")).toBe(DEFAULT_APPEARANCE.textScale);
    expect(root.getAttribute("data-theme")).toBe(DEFAULT_APPEARANCE.theme);
    expect(root.getAttribute("data-border-contrast")).toBe(DEFAULT_APPEARANCE.borderContrast);
    expect(root.hasAttribute("data-reduce-motion")).toBe(DEFAULT_APPEARANCE.reduceMotion);
    expect(root.hasAttribute("data-pointer-cursor")).toBe(DEFAULT_APPEARANCE.pointerCursor);
    expect(root.hasAttribute("data-underline-links")).toBe(DEFAULT_APPEARANCE.underlineLinks);
  });

  it("prefers stored values over defaults", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ borderContrast: "strong", pointerCursor: false, radius: "soft" }),
    );

    runBootstrapScript();

    const root = document.documentElement;

    expect(root.getAttribute("data-radius")).toBe("soft");
    expect(root.getAttribute("data-border-contrast")).toBe("strong");
    expect(root.hasAttribute("data-pointer-cursor")).toBe(false);
    expect(root.getAttribute("data-theme")).toBe(DEFAULT_APPEARANCE.theme);
  });

  it("falls back to defaults when storage is malformed", () => {
    window.localStorage.setItem(STORAGE_KEY, "not-json");

    expect(runBootstrapScript).not.toThrow();
    expect(document.documentElement.getAttribute("data-radius")).toBe(DEFAULT_APPEARANCE.radius);
  });

  it("matches the attributes applied after hydration", () => {
    const preferences = {
      ...DEFAULT_APPEARANCE,
      borderContrast: "strong" as const,
      pointerCursor: false,
      radius: "soft" as const,
      reduceMotion: true,
      textScale: "large" as const,
      theme: "ocean" as const,
      underlineLinks: true,
    };

    applyAppearancePreferences(preferences);
    const applied = APPLIED_ATTRIBUTES.map((attribute) =>
      document.documentElement.getAttribute(attribute),
    );

    resetDocumentElement();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    runBootstrapScript();

    expect(
      APPLIED_ATTRIBUTES.map((attribute) => document.documentElement.getAttribute(attribute)),
    ).toEqual(applied);
  });
});

describe("appearance schemas", () => {
  it("fills defaults for an empty object", () => {
    expect(AppearancePreferencesSchema.parse({})).toEqual(DEFAULT_APPEARANCE);
  });

  it("resets only the invalid fields", () => {
    const parsed = AppearancePreferencesSchema.parse({
      radius: "square",
      textScale: "large",
      theme: "neon",
    });

    expect(parsed.radius).toBe(DEFAULT_APPEARANCE.radius);
    expect(parsed.theme).toBe(DEFAULT_APPEARANCE.theme);
    expect(parsed.textScale).toBe("large");
  });

  it("strips unknown keys", () => {
    expect(AppearancePreferencesSchema.parse({ accent: "neon" })).toEqual(DEFAULT_APPEARANCE);
  });

  it("rejects invalid input instead of coercing it", () => {
    expect(AppearanceInputSchema.safeParse({ radius: "square" }).success).toBe(false);
  });

  it("requires every field on input", () => {
    expect(AppearanceInputSchema.safeParse({}).success).toBe(false);
  });

  it("accepts a partial patch", () => {
    expect(AppearancePatchSchema.parse({ radius: "soft" })).toEqual({ radius: "soft" });
  });
});
