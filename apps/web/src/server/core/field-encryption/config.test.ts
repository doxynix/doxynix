import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/config/env.server", () => ({
  PRISMA_FIELD_ENCRYPTION_HASH_SALT: "unit-test-salt",
}));

import { getNormalizedHash, getRawHash } from "@/server/utils/hash";

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

  it("hashes the salted value to a known-good digest", () => {
    // `sha256("user@example.com" + "unit-test-salt")`, the retired library's streamed `update(value)` then `update(utf8(salt))`; pinning the literal is what makes this a contract test instead of one that passes by construction.
    expect(hashValue("user@example.com", ["lowercase", "trim"])).toBe(
      "98ede1c4555925b16f5aa92fae3f23cd7036de4e58ed980987f68b926dc85d62",
    );
  });

  it("stays byte-compatible with getRawHash, the reference the repo already trusts", () => {
    // `getRawHash` is an independent implementation (one-shot `crypto.hash`, documented in `src/server/utils/hash.ts` as byte-compatible with `prisma-field-encryption`), so this tests the compatibility claim instead of restating this function's own algorithm.
    for (const value of ["user@example.com", "SESS_SECRET", "Ünïcødé 🎯", ""]) {
      expect(hashValue(value, [])).toBe(getRawHash(value));
    }
  });

  it("does not NFC-normalize, which is what separates it from getNormalizedHash", () => {
    // The normalize vocabulary is only `lowercase`/`trim`, so a silently added Unicode pass must not change every non-ASCII digest; the NFC/NFD strings are built from code points so no formatter can collapse them.
    const nfc = String.fromCodePoint(0x63, 0x61, 0x66, 0xe9);
    const nfd = String.fromCodePoint(0x63, 0x61, 0x66, 0x65, 0x3_01);

    expect(hashValue(nfc, ["lowercase", "trim"])).not.toBe(hashValue(nfd, ["lowercase", "trim"]));
    expect(hashValue(nfd, ["lowercase", "trim"])).toBe(getRawHash(nfd));
    expect(getNormalizedHash(nfd)).toBe(getNormalizedHash(nfc));
  });

  it("applies normalize options before hashing", () => {
    const lower = hashValue("USER@Example.COM", ["lowercase"]);
    const plain = hashValue("user@example.com", []);

    expect(lower).toBe(plain);
    expect(hashValue("  user@example.com  ", ["trim"])).toBe(plain);
  });
});
