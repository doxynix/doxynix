import { describe, expect, it, vi } from "vitest";

// The salt is genuinely absent in some environments (`env.server` turns an empty
// string into `undefined`). The library skipped the salt update in that case, so
// the digest must fall back to hashing the bare value - not `value + "undefined"`.
vi.mock("@/shared/config/env.server", () => ({
  PRISMA_FIELD_ENCRYPTION_HASH_SALT: undefined,
}));

import { getRawHash } from "@/server/utils/hash";

import { hashValue } from "./config";

describe("field-encryption config without a hash salt", () => {
  it("hashes the bare value to a known-good digest", () => {
    // `sha256("SESS_SECRET")`, i.e. no salt appended at all.
    expect(hashValue("SESS_SECRET", [])).toBe(
      "3b6292c3193a7ffda34ba5ee423528a9e3fd83da8ba327be5b0da37416b06955",
    );
  });

  it("never appends an absent salt as the literal string 'undefined'", () => {
    // Regression guard, found by the integration suite rather than by any unit
    // test: every `config` unit test mocks a salt, so only the real end-to-end
    // run could see this. `sha256("SESS_SECRET" + "undefined")` is what a missing
    // salt produced before the fix, and it diverges from every row already stored.
    expect(hashValue("SESS_SECRET", [])).not.toBe(
      "f16df4b39ba3525707c772a3a5e2f397d5f40042eb65fc532886cb0449cd93fa",
    );
  });

  it("agrees with getRawHash in the no-salt configuration", () => {
    // `getRawHash` has its own explicit no-salt branch, so this cross-check
    // fails if the two drift apart again.
    for (const value of ["SESS_SECRET", "user@example.com", ""]) {
      expect(hashValue(value, [])).toBe(getRawHash(value));
    }
  });

  it("still normalizes before hashing", () => {
    expect(hashValue("  USER@Example.COM  ", ["lowercase", "trim"])).toBe(
      hashValue("user@example.com", []),
    );
  });
});
