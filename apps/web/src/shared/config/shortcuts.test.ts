import { describe, expect, it } from "vitest";

import {
  formatSequence,
  formatShortcut,
  parseSequentialShortcut,
  SHORTCUT_ENTRIES,
  SHORTCUTS,
  toHotkeySequence,
} from "./shortcuts";

describe("formatShortcut", () => {
  it("renders two-key sequences as two presses", () => {
    expect(formatSequence("g then d")).toBe("G then D");
    expect(formatShortcut("g then d", "Ctrl")).toBe("G then D");
  });

  it("uses the platform modifier for chords", () => {
    expect(formatShortcut("mod+k", "⌘")).toBe("⌘+K");
    expect(formatShortcut("mod+b", "Ctrl")).toBe("Ctrl+B");
  });

  it("keeps a display override for keys that are not chords", () => {
    expect(SHORTCUTS.shortcutsHelp.display).toBe("Shift+?");
  });
});

describe("parseSequentialShortcut", () => {
  it("extracts the prefix and second key", () => {
    expect(parseSequentialShortcut("g then r")).toEqual({ prefix: "g", secondKey: "r" });
  });

  it("returns null for chords and malformed input", () => {
    expect(parseSequentialShortcut("mod+k")).toBeNull();
    expect(parseSequentialShortcut("g r")).toBeNull();
  });
});

describe("toHotkeySequence", () => {
  it("converts the registry format to the library format", () => {
    expect(toHotkeySequence("g then d")).toBe("g>d");
  });

  it("returns null for chords", () => {
    expect(toHotkeySequence("mod+k")).toBeNull();
  });
});

describe("SHORTCUT_ENTRIES", () => {
  it("registers each binding only once", () => {
    const keys = SHORTCUT_ENTRIES.map((entry) => entry.keys);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives every navigation entry a route and a sequence", () => {
    for (const entry of SHORTCUT_ENTRIES) {
      if (entry.group !== "navigation") {
        continue;
      }

      expect(entry.href).toBeDefined();
      expect(parseSequentialShortcut(entry.keys)).not.toBeNull();
    }
  });

  it("keeps actions and repo map commands sequential", () => {
    for (const entry of SHORTCUT_ENTRIES) {
      if (entry.group === "interface") {
        continue;
      }

      expect(parseSequentialShortcut(entry.keys)).not.toBeNull();
    }
  });
});
