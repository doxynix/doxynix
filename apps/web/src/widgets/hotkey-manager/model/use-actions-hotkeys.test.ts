import { describe, expect, it } from "vitest";

import { processGlobalHotkeySequence } from "./use-actions-hotkeys";

describe("processGlobalHotkeySequence", () => {
  it("should return ignore action when prefix is missing", () => {
    const result = processGlobalHotkeySequence(null, "KeyR");
    expect(result).toEqual({ action: "ignore" });
  });

  it("should successfully execute command on valid c + r sequence", () => {
    const result = processGlobalHotkeySequence("c", "KeyR");
    expect(result).toEqual({ action: "execute", command: "createRepo" });
  });

  it("should reset state when the second key is not an alphabetic letter", () => {
    const result = processGlobalHotkeySequence("c", "Digit1");
    expect(result).toEqual({ action: "reset" });
  });

  it("should reset state when prefix is valid but second letter is wrong", () => {
    const result = processGlobalHotkeySequence("c", "KeyX");
    expect(result).toEqual({ action: "reset" });
  });

  it("should reset state when an unrecognized prefix is provided", () => {
    const result = processGlobalHotkeySequence("x", "KeyR");
    expect(result).toEqual({ action: "reset" });
  });
});
