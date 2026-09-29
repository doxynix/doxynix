import { describe, expect, it } from "vitest";

import { COMPAT_FIXTURE } from "./compat-fixture";
import { findKeyForMessage, makeKeychain, parseKey } from "./keyring";

describe("field-encryption keyring", () => {
  it("derives the same fingerprint the library reported", () => {
    const parsed = parseKey(COMPAT_FIXTURE.KEY);

    expect(parsed.fingerprint).toBe(COMPAT_FIXTURE.fingerprint);
  });

  it("decodes the same raw key bytes the library decoded", () => {
    const parsed = parseKey(COMPAT_FIXTURE.KEY);

    expect(parsed.raw.toString("base64url")).toBe(COMPAT_FIXTURE.rawKey);
    expect(parsed.raw).toHaveLength(32);
  });

  it("rejects a key that is not a 32-byte k1.aesgcm256 string", () => {
    for (const bad of ["", "nope", "k1.aesgcm256.short", "k2.aesgcm256.abcdefgh"]) {
      expect(() => parseKey(bad)).toThrow(/Invalid encryption key/);
    }
  });

  it("resolves a message fingerprint against the keychain", () => {
    const keychain = makeKeychain([COMPAT_FIXTURE.KEY]);

    expect(findKeyForMessage(COMPAT_FIXTURE.fingerprint, keychain).raw.toString("base64url")).toBe(
      COMPAT_FIXTURE.rawKey,
    );
  });

  it("throws rather than silently skipping an unknown fingerprint", () => {
    const keychain = makeKeychain([COMPAT_FIXTURE.KEY]);

    expect(() => findKeyForMessage("00000000", keychain)).toThrow(/No key available/);
  });

  it("de-duplicates repeated keys and keeps insertion order", () => {
    const keychain = makeKeychain([COMPAT_FIXTURE.KEY, COMPAT_FIXTURE.KEY]);

    expect(Object.keys(keychain)).toEqual([COMPAT_FIXTURE.fingerprint]);
  });
});
