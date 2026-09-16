import { describe, expect, it, vi } from "vitest";

vi.mock("./constants", () => ({
  ENCRYPTED_METADATA_MAP: {
    ApiKey: { key: true, secret: true },
    User: { passwordHash: true },
  },
}));

import { maskSensitiveFields, sanitizePayload } from "@/server/utils/sanitize-payload";

describe("shared/lib/utils:sanitizePayload", () => {
  const SENSITIVE_FIELDS = [
    "password",
    "newPassword",
    "passwordHash",
    "hash",
    "salt",
    "token",
    "sessionToken",
    "verificationToken",
    "identifier",
    "access_token",
    "refresh_token",
    "id_token",
    "hashedKey",
    "secret",
    "clientSecret",
    "cvv",
    "creditCard",
    "iban",
  ] as const;

  it("should redact all sensitive fields on root level", () => {
    const input = Object.fromEntries(
      SENSITIVE_FIELDS.map((field) => [field, `${field}_value`]),
    ) as Record<(typeof SENSITIVE_FIELDS)[number], string>;

    const result = sanitizePayload(input) as Record<(typeof SENSITIVE_FIELDS)[number], string>;

    for (const key of SENSITIVE_FIELDS) {
      expect(result[key]).toBe("[REDACTED]");
    }
  });

  it("should redact nested objects and arrays without mutating original value", () => {
    const input = {
      meta: { page: 1 },
      nested: {
        password: "p1",
        token: "t1",
      },
      users: [
        { access_token: "a1", login: "alice" },
        { login: "bob", refresh_token: "r1" },
      ],
    };

    const result = sanitizePayload(input) as {
      meta: { page: number };
      nested: { password: string; token: string };
      users: Array<{ access_token?: string; login: string; refresh_token?: string }>;
    };

    expect(result).toEqual({
      meta: { page: 1 },
      nested: {
        password: "[REDACTED]",
        token: "[REDACTED]",
      },
      users: [
        { access_token: "[REDACTED]", login: "alice" },
        { login: "bob", refresh_token: "[REDACTED]" },
      ],
    });
    expect(input.nested.password).toBe("p1");
    expect(input.users[0]?.access_token).toBe("a1");
  });

  it("redacts raw strings containing bearer tokens or github PATs", () => {
    const strWithGh = "Authorization: github_pat_11AAAAAA00000000000000_BBBBBBBBBBBBBBBBBBBB";
    const strWithBearer = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";

    expect(sanitizePayload(strWithGh)).toContain("[REDACTED_GH_TOKEN]");
    expect(sanitizePayload(strWithBearer)).toBe("Bearer [REDACTED]");
  });

  it("truncates strings longer than 8192 characters", () => {
    const giantString = "a".repeat(9000);
    const result = sanitizePayload(giantString) as string;

    expect(result).toContain("[TRUNCATED, ORIGINAL LENGTH: 9000]");
    expect(result.length).toBeLessThan(2000);
  });

  it("handles BigInt and non-object primitives safely", () => {
    expect(sanitizePayload(BigInt(123_456_789))).toBe("123456789");
    expect(sanitizePayload(null)).toBeNull();
    expect(sanitizePayload(undefined)).toBeUndefined();
    expect(sanitizePayload(42)).toBe(42);
  });
});

describe("shared/lib/utils:maskSensitiveFields", () => {
  it("returns unchanged non-object or null data", () => {
    expect(maskSensitiveFields("ApiKey", null)).toBeNull();
    expect(maskSensitiveFields("ApiKey", "string")).toBe("string");
  });

  it("returns original data if model is not in encryption map", () => {
    const data = { secret: "123" };
    expect(maskSensitiveFields("UnknownModel", data)).toEqual(data);
  });

  it("masks sensitive fields at root and inside nested data object", () => {
    const data = {
      data: {
        key: "secret-key-123",
        other: "visible",
      },
      name: "My API Key",
      secret: "super-secret-token",
    };

    const masked = maskSensitiveFields("ApiKey", data) as typeof data;

    expect(masked.secret).toBe("[ENCRYPTED_MASKED]");
    expect(masked.name).toBe("My API Key");
    expect(masked.data.key).toBe("[ENCRYPTED_MASKED]");
    expect(masked.data.other).toBe("visible");
  });
});
