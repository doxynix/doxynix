import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/config/env.server", () => ({
  PRISMA_FIELD_ENCRYPTION_HASH_SALT: "unit-test-salt",
}));

import { getModelSpec, getSensitiveFieldNames, hashValue } from "./config";
import { FIELD_ENCRYPTION_SPEC } from "./config.generated";

describe("field-encryption config", () => {
  it("exposes the generated models", () => {
    expect(Object.keys(FIELD_ENCRYPTION_SPEC)).toContain("User");
    expect(getModelSpec("User").fields.email).toBeDefined();
  });

  it("returns an empty spec for an unknown model", () => {
    expect(getModelSpec("NotAModel")).toEqual({ connections: {}, fields: {} });
  });

  it("lists sensitive field names for audit masking", () => {
    const names = getSensitiveFieldNames("User");

    expect(names.has("email")).toBe(true);
    expect(names.has("emailHash")).toBe(true);
    expect(names.has("id")).toBe(false);
    expect(getSensitiveFieldNames("NotAModel").size).toBe(0);
  });

  it("hashes with the salt appended, matching the library", () => {
    const expected = createHash("sha256")
      .update("user@example.comunit-test-salt", "utf8")
      .digest("hex");

    expect(hashValue("user@example.com", ["lowercase", "trim"])).toBe(expected);
  });

  it("applies normalize options before hashing", () => {
    const lower = hashValue("USER@Example.COM", ["lowercase"]);
    const plain = hashValue("user@example.com", []);

    expect(lower).toBe(plain);
    expect(hashValue("  user@example.com  ", ["trim"])).toBe(plain);
  });
});
