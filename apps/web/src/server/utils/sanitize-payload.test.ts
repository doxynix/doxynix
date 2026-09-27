import { describe, expect, it, vi } from "vitest";

vi.mock("./constants", () => ({
  ENCRYPTED_METADATA_MAP: {
    ApiKey: { key: true, secret: true },
    User: { passwordHash: true },
  },
}));

import {
  maskSensitiveFields,
  sanitizeObject,
  sanitizePayload,
} from "@/server/utils/sanitize-payload";

describe("shared/lib/utils:sanitizePayload", () => {
  const BEARER_SECRET = "s3cr3t-jwt-payload-value";

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

  it.each([
    ["letter prefix", `xBearer ${BEARER_SECRET}`],
    ["digit prefix", `1Bearer ${BEARER_SECRET}`],
    ["hyphen prefix", `X-Bearer ${BEARER_SECRET}`],
    ["colon prefix", `:Bearer ${BEARER_SECRET}`],
    ["authorization header", `Authorization: Bearer ${BEARER_SECRET}`],
    ["lowercase prefix", `xbearer ${BEARER_SECRET}`],
  ])("redacts a bearer credential with a %s", (_label, input) => {
    const result = sanitizePayload(input) as string;

    expect(result).not.toContain(BEARER_SECRET);
    expect(result).toContain("[REDACTED]");
  });

  it("redacts a realistic Authorization: Bearer JWT header verbatim", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVP";
    const result = sanitizePayload(`Authorization: Bearer ${jwt}`) as string;

    expect(result).not.toContain(jwt);
    expect(result).not.toContain("eyJhbGciOiJIUzI1NiI");
    expect(result).toBe("Authorization: Bearer [REDACTED]");
  });

  it("redacts a bearer credential nested under a non-sensitive key", () => {
    const result = sanitizePayload({
      body: `upstream said xBearer ${BEARER_SECRET}`,
      headers: [`Authorization: Bearer ${BEARER_SECRET}`],
    }) as { body: string; headers: string[] };

    expect(JSON.stringify(result)).not.toContain(BEARER_SECRET);
  });

  it("leaves identifiers that merely contain the word bearer untouched", () => {
    expect(sanitizePayload("MyBearerToken")).toBe("MyBearerToken");
    expect(sanitizePayload('{"tokenBearer":"abc"}')).toBe('{"tokenBearer":"abc"}');
    expect(sanitizePayload("unbearable")).toBe("unbearable");
    expect(sanitizePayload("bearer")).toBe("bearer");
  });

  it("redacts a bearer credential at every offset across an oversized payload", () => {
    for (const lead of ["", " ", ":", "-", "x", "1"]) {
      for (let offset = 0; offset <= 8400; offset += 97) {
        const input = `${".".repeat(offset)}${lead}Bearer ${BEARER_SECRET}${".".repeat(8400 - offset)}`;
        const result = sanitizePayload(input) as string;
        expect(result, `lead=${JSON.stringify(lead)} offset=${offset}`).not.toContain(
          BEARER_SECRET,
        );
      }
    }
  });

  it("truncates oversized strings and reports the original input length", () => {
    const giantString = "a".repeat(9000);
    const result = sanitizePayload(giantString) as string;

    expect(result).toContain("[TRUNCATED, ORIGINAL LENGTH: 9000]");
    expect(result.length).toBeLessThan(1100);
  });

  it("redacts credentials inside a string longer than 8192 characters", () => {
    const ghToken = `ghp_${"A".repeat(36)}`;
    const bearerSecret = "b".repeat(40);
    const giantString = [
      `Authorization: ${ghToken}`,
      `Proxy: Bearer ${bearerSecret}`,
      "z".repeat(9000),
    ].join("\n");
    expect(giantString.length).toBeGreaterThan(8192);

    const result = sanitizePayload(giantString) as string;

    expect(result).not.toContain(ghToken);
    expect(result).not.toContain(bearerSecret);
    expect(result).toContain("[REDACTED_GH_TOKEN]");
    expect(result).toContain("Bearer [REDACTED]");
    expect(result).toContain(`[TRUNCATED, ORIGINAL LENGTH: ${giantString.length}]`);
  });

  it("redacts before slicing, so a token straddling the cut is not partially logged", () => {
    const ghToken = `ghp_${"C".repeat(36)}`;
    const pad = "y".repeat(1024 - 10);
    expect(pad.length + ghToken.length).toBeGreaterThan(1024);

    const result = sanitizePayload(`${pad}${ghToken}${"z".repeat(4000)}`) as string;

    expect(result).toContain("[TRUNCATED");
    expect(result).not.toContain("ghp_");
    expect(result).not.toContain(ghToken);
    expect(result).toContain("REDACTED");
  });

  it("truncates the redacted copy rather than the raw input", () => {
    const result = sanitizePayload(`ghp_${"D".repeat(36)} ${"a".repeat(9000)}`) as string;

    expect(result.startsWith("[REDACTED_GH_TOKEN]")).toBe(true);
    expect(result).toContain("[TRUNCATED, ORIGINAL LENGTH:");
    expect(result.length).toBeLessThan(1100);
  });

  it("respects the MAX_STRING_LENGTH boundary in both directions", () => {
    const atBudget = "a".repeat(1024);
    expect(sanitizePayload(atBudget)).toBe(atBudget);

    const overBudget = "a".repeat(1025);
    const result = sanitizePayload(overBudget) as string;

    expect(result.startsWith("a".repeat(1024))).toBe(true);
    expect(result).toContain("[TRUNCATED, ORIGINAL LENGTH: 1025]");
  });

  it("handles BigInt and non-object primitives safely", () => {
    expect(sanitizePayload(BigInt(123_456_789))).toBe("123456789");
    expect(sanitizePayload(null)).toBeNull();
    expect(sanitizePayload(undefined)).toBeUndefined();
    expect(sanitizePayload(42)).toBe(42);
  });
});

describe("shared/lib/utils:sanitizeObject", () => {
  it("returns {} for null", () => {
    expect(sanitizeObject(null)).toEqual({});
  });

  it("returns {} for a number", () => {
    expect(sanitizeObject(42)).toEqual({});
  });

  it("returns {} for a string", () => {
    expect(sanitizeObject("str")).toEqual({});
  });

  it("removes SKIP_FIELDS while preserving other keys", () => {
    const input = { id: 1, name: "x", nested: { a: 1 }, repoId: 2 };
    expect(sanitizeObject(input)).toEqual({ name: "x", nested: { a: 1 } });
  });

  it("converts bigint values to strings", () => {
    expect(sanitizeObject({ n: 10n })).toEqual({ n: "10" });
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
