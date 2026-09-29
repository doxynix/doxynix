import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/config/env.server", () => ({
  PRISMA_FIELD_ENCRYPTION_HASH_SALT: "integration-salt",
}));

import { encryptString, parseEncryptedString } from "./cipher";
import { COMPAT_FIXTURE } from "./compat-fixture";
import { getModelSpec, hashValue } from "./config";
import { makeKeychain, parseKey } from "./keyring";
import { decryptOnRead, encryptOnWrite } from "./rewrite";

const KEY = `k1.aesgcm256.${Buffer.from("0123456789abcdef0123456789abcdef").toString("base64url")}`;
// sha256 yields exactly the 32 raw bytes the key format requires, without a
// 32-character literal in the source.
const ROTATED = `k1.aesgcm256.${createHash("sha256").update("rotated").digest("base64url")}`;
const key = parseKey(KEY);
const keychain = makeKeychain([KEY, ROTATED]);

/**
 * The encrypted surface the retired `ENCRYPTED_METADATA_MAP` declared: seven
 * models, 12 ciphertext columns, 6 of them paired with a deterministic hash
 * column. `null` means "encrypted, no hash column"; an array is the hash
 * column's `normalize` options.
 */
const EXPECTED_SPEC: Record<string, Record<string, null | string[]>> = {
  Account: {
    accessToken: null,
    email: ["lowercase", "trim"],
    idToken: null,
    refreshToken: null,
  },
  BannedEmail: { email: ["lowercase", "trim"] },
  ChatMessage: { parts: null },
  Document: { content: null },
  Session: { token: [] },
  User: { email: ["lowercase", "trim"], name: null },
  Verification: { identifier: ["lowercase", "trim"], value: [] },
};

describe("field-encryption end to end", () => {
  it("covers every model and field the generated spec declares", () => {
    const spec = getModelSpec("User");

    // `emailHash` is not a separate entry: the generator folds `@encryption:hash`
    // onto the field it hashes, so only the ciphertext columns are listed.
    expect(Object.keys(spec.fields).sort()).toEqual(["email", "name"]);
    expect(Object.keys(spec.connections)).toContain("accounts");
  });

  it("writes a User row the way the library would, and reads it back", () => {
    const written = encryptOnWrite(
      { data: { email: "User@Example.com", name: "Ada" } },
      "User",
      key,
    );
    const data = written.data as Record<string, unknown>;

    expect(parseEncryptedString(data.email as string)).not.toBe(false);
    expect(parseEncryptedString(data.name as string)).not.toBe(false);
    expect(data.emailHash).toBe(hashValue("User@Example.com", ["lowercase", "trim"]));

    const read: Record<string, unknown> = { ...data };
    decryptOnRead(read, "User", true, keychain, () => {
      throw new Error("decryption should not fail here");
    });

    expect(read.email).toBe("User@Example.com");
    expect(read.name).toBe("Ada");
  });

  it("reads a row written by prisma-field-encryption 1.6.0", () => {
    const read: Record<string, unknown> = { email: COMPAT_FIXTURE.ciphertext };

    decryptOnRead(read, "User", true, keychain, () => {
      throw new Error("decryption should not fail here");
    });

    expect(read.email).toBe(COMPAT_FIXTURE.plaintext);
  });

  it("resolves a ciphertext written under the rotated-away key", () => {
    const oldKey = parseKey(ROTATED);
    const legacy = encryptString("rotated-user@example.com", oldKey.raw, oldKey.fingerprint);
    const read: Record<string, unknown> = { email: legacy };

    decryptOnRead(read, "User", true, keychain, () => {
      throw new Error("decryption should not fail here");
    });

    expect(read.email).toBe("rotated-user@example.com");
  });

  it("keeps every encrypted field across all seven models in sync with the schema", () => {
    const actual: Record<string, Record<string, null | string[]>> = {};

    for (const model of Object.keys(EXPECTED_SPEC)) {
      actual[model] = Object.fromEntries(
        Object.entries(getModelSpec(model).fields).map(([field, spec]) => [
          field,
          spec.hash == null ? null : spec.hash.normalize,
        ]),
      );
    }

    expect(actual).toEqual(EXPECTED_SPEC);
  });
});
