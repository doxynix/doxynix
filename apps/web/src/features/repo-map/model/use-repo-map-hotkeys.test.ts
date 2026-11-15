import { describe, expect, it } from "vitest";

import { createMapCommands, resolveMapCommand } from "./use-repo-map-hotkeys";

describe("resolveMapCommand", () => {
  it("resolves map commands accurately by prefix and key code", () => {
    expect(resolveMapCommand("f", "KeyS")).toBe("focusSelected");
    expect(resolveMapCommand("f", "KeyV")).toBe("fitView");
    expect(resolveMapCommand("t", "KeyC")).toBe("toggleControls");
    expect(resolveMapCommand("z", "KeyI")).toBe("zoomIn");
    expect(resolveMapCommand("z", "KeyO")).toBe("zoomOut");
  });

  it("returns null for unsupported combinations and non-character keys", () => {
    expect(resolveMapCommand("f", "KeyX")).toBeNull();
    expect(resolveMapCommand("unknown", "KeyS")).toBeNull();
    expect(resolveMapCommand("f", "Enter")).toBeNull();
    expect(resolveMapCommand("z", "Escape")).toBeNull();
  });
});

describe("createMapCommands", () => {
  it("maps every map sequence to its command", () => {
    const commands = createMapCommands();

    expect(commands.get("f>s")).toBe("focusSelected");
    expect(commands.get("f>v")).toBe("fitView");
    expect(commands.get("t>c")).toBe("toggleControls");
    expect(commands.get("z>i")).toBe("zoomIn");
    expect(commands.get("z>o")).toBe("zoomOut");
  });

  it("registers every map command exactly once", () => {
    expect(createMapCommands().size).toBe(5);
  });
});
