import { describe, expect, it } from "vitest";

import { deriveDefaultName, isPlaceholderName } from "./default-name";

describe("deriveDefaultName", () => {
  it("uses the local part of the email", () => {
    expect(deriveDefaultName("karen@example.com")).toBe("karen");
  });

  it("falls back to a usable name when the local part is empty", () => {
    expect(deriveDefaultName("@example.com")).toBe("User");
    expect(deriveDefaultName("   @example.com")).toBe("User");
  });

  it("falls back when there is no email at all", () => {
    expect(deriveDefaultName(null)).toBe("User");
    expect(deriveDefaultName(undefined)).toBe("User");
    expect(deriveDefaultName("")).toBe("User");
  });

  it("never returns an empty name, because the column requires one character", () => {
    for (const email of ["@example.com", "", "  ", null, undefined, "a@b"]) {
      expect(deriveDefaultName(email).length).toBeGreaterThan(0);
    }
  });

  it("caps the name at the column limit", () => {
    const email = `${"a".repeat(80)}@example.com`;

    expect(deriveDefaultName(email)).toHaveLength(50);
  });
});

describe("isPlaceholderName", () => {
  it("treats a missing or empty name as a placeholder", () => {
    expect(isPlaceholderName(null, "karen@example.com")).toBe(true);
    expect(isPlaceholderName("", "karen@example.com")).toBe(true);
  });

  it("treats the derived name as a placeholder", () => {
    expect(isPlaceholderName("karen", "karen@example.com")).toBe(true);
  });

  it("treats a name the user chose as final", () => {
    expect(isPlaceholderName("Karen Avakoff", "karen@example.com")).toBe(false);
  });

  it("agrees with the derivation, so the sentinel cannot drift", () => {
    const email = "karen@example.com";

    expect(isPlaceholderName(deriveDefaultName(email), email)).toBe(true);
  });
});
