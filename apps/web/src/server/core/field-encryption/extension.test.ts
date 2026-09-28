import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/config/env.server", () => ({
  PRISMA_FIELD_ENCRYPTION_HASH_SALT: "unit-test-salt",
}));

import { encryptString } from "./cipher";
import { fieldEncryptionExtension } from "./index";
import { parseKey } from "./keyring";

const KEY = `k1.aesgcm256.${Buffer.from("0123456789abcdef0123456789abcdef").toString("base64url")}`;

describe("fieldEncryptionExtension", () => {
  it("throws a clear error when the encryption key is malformed", () => {
    expect(() => fieldEncryptionExtension({ encryptionKey: "not-a-key" })).toThrow(
      /Invalid encryption key/,
    );
  });

  it("rejects a key that is absent entirely", () => {
    expect(() => fieldEncryptionExtension({ encryptionKey: "" })).toThrow(
      /No encryption key configured/,
    );
  });

  it("accepts an explicit rotation key list", () => {
    const second = `k1.aesgcm256.${Buffer.from("11111111111111111111111111111111").toString("base64url")}`;

    expect(() =>
      fieldEncryptionExtension({ decryptionKeys: [second], encryptionKey: KEY }),
    ).not.toThrow();
  });

  it("builds without touching Prisma.dmmf", () => {
    // The regression this task exists for: the old library read
    // `Prisma.dmmf`, which Prisma 7 removes. The extension must construct
    // without any DMMF access, so calling it outside a Prisma context is fine.
    expect(() => fieldEncryptionExtension({ encryptionKey: KEY })).not.toThrow();
  });

  it("round-trips a User email through the shared cipher and keyring", () => {
    const parsed = parseKey(KEY);
    const value = encryptString("user@example.com", parsed.raw, parsed.fingerprint);

    expect(value.startsWith("v1.aesgcm256.")).toBe(true);
  });
});
