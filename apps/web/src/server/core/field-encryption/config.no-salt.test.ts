import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

// The salt is genuinely absent in some environments (`env.server` turns an empty
// string into `undefined`). The library skipped the salt update in that case, so
// the digest must fall back to hashing the bare value - not `value + "undefined"`.
vi.mock("@/shared/config/env.server", () => ({
  PRISMA_FIELD_ENCRYPTION_HASH_SALT: undefined,
}));

import { hashValue } from "./config";

describe("field-encryption config without a hash salt", () => {
  it("hashes the bare value, matching getRawHash's no-salt branch", () => {
    const expected = createHash("sha256").update("SESS_SECRET", "utf8").digest("hex");

    expect(hashValue("SESS_SECRET", [])).toBe(expected);
    expect(hashValue("SESS_SECRET", [])).not.toBe(
      createHash("sha256").update("SESS_SECRETundefined", "utf8").digest("hex"),
    );
  });

  it("still normalizes before hashing", () => {
    expect(hashValue("  USER@Example.COM  ", ["lowercase", "trim"])).toBe(
      hashValue("user@example.com", []),
    );
  });
});
