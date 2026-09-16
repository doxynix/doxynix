import { describe, expect, it } from "vitest";

import { getInitials } from "@/shared/lib/get-initials";

describe("shared/lib/utils:getInitials", () => {
  it("should return initials for names with two or more words", () => {
    const fullName = "Ada Lovelace Byron";

    const result = getInitials(fullName);

    expect(result).toBe("AL");
  });

  it("should return one letter for a single-word name", () => {
    const name = "Cher";

    const result = getInitials(name);

    expect(result).toBe("C");
  });

  it("should trim extra spaces in name before extracting initials", () => {
    const name = "   Alan    Turing   ";

    const result = getInitials(name);

    expect(result).toBe("AT");
  });

  it("should support non-latin names", () => {
    const name = "Иван Петров";

    const result = getInitials(name);

    expect(result).toBe("ИП");
  });

  it("should fallback to email initial when name is null or undefined", () => {
    const email = "user@example.com";

    const fromNull = getInitials(null, email);
    const fromUndefined = getInitials(undefined, email);

    expect(fromNull).toBe("U");
    expect(fromUndefined).toBe("U");
  });

  it("should return U when both name and email are missing", () => {
    const name = null;
    const email = undefined;

    const result = getInitials(name, email);

    expect(result).toBe("U");
  });
});
