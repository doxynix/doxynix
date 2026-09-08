import { describe, expect, it } from "vitest";

import { maskEmail, normalizeEmail } from "@/server/utils/email-guard";
import { hasText, isEmpty } from "@/server/utils/string-utils";

describe("String Utils (replacement validation)", () => {
  it("hasText correctly detects non-empty strings", () => {
    expect(hasText("hello")).toBe(true);
    expect(hasText("  hello  ")).toBe(true);
    expect(hasText("")).toBe(false);
    expect(hasText("   ")).toBe(false);
    expect(hasText(null)).toBe(false);
    expect(hasText(undefined)).toBe(false);
    expect(hasText(123)).toBe(false);
  });

  it("isEmpty correctly detects empty or whitespace strings", () => {
    expect(isEmpty("")).toBe(true);
    expect(isEmpty("   ")).toBe(true);
    expect(isEmpty(null)).toBe(true);
    expect(isEmpty(undefined)).toBe(true);
    expect(isEmpty("hello")).toBe(false);
    expect(isEmpty("  a  ")).toBe(false);
  });
});

describe("Email Normalization & Masking", () => {
  it("normalizes standard emails to lowercase and trims whitespace", () => {
    expect(normalizeEmail("  User@Example.COM  ")).toBe("user@example.com");
    expect(normalizeEmail("John.Doe@Company.org")).toBe("john.doe@company.org");
  });

  it("preserves dots in Gmail addresses (critical for Google OAuth)", () => {
    expect(normalizeEmail("john.doe@gmail.com")).toBe("john.doe@gmail.com");
    expect(normalizeEmail("J.O.H.N.doe@GMAIL.COM")).toBe("j.o.h.n.doe@gmail.com");
  });

  it("removes subaddress tags (+tag) for Gmail addresses", () => {
    expect(normalizeEmail("developer+test@gmail.com")).toBe("developer@gmail.com");
    expect(normalizeEmail("user+newsletter+promo@gmail.com")).toBe("user@gmail.com");
    expect(normalizeEmail("my.name+filter@googlemail.com")).toBe("my.name@gmail.com");
  });

  it("unifies googlemail.com to gmail.com", () => {
    expect(normalizeEmail("test@googlemail.com")).toBe("test@gmail.com");
  });

  it("handles malformed or fallback strings gracefully", () => {
    expect(normalizeEmail("not-an-email")).toBe("not-an-email");
    expect(normalizeEmail("   ")).toBe("");
  });

  it("correctly masks email for logging without revealing local part", () => {
    const masked = maskEmail("developer@doxynix.com");
    expect(masked).toMatch(/^d\.\.\.[a-f0-9]{10}@doxynix\.com$/);
    expect(maskEmail(null)).toBe("unknown@address");
    expect(maskEmail("invalid")).toBe("invalid-email");
  });
});
