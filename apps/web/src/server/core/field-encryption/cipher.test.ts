import { describe, expect, it } from "vitest";

import {
  decryptString,
  encodeEncryptedString,
  encryptString,
  looksEncrypted,
  parseEncryptedString,
} from "./cipher";
import { COMPAT_FIXTURE } from "./compat-fixture";

const RAW_KEY = Buffer.from("0123456789abcdef0123456789abcdef", "utf8");

describe("field-encryption cipher", () => {
  it("decrypts a ciphertext produced by prisma-field-encryption 1.6.0", () => {
    const parsed = parseEncryptedString(COMPAT_FIXTURE.ciphertext);

    expect(parsed).not.toBe(false);
    if (parsed === false) {
      return;
    }

    expect(decryptString(COMPAT_FIXTURE.ciphertext, RAW_KEY)).toBe(COMPAT_FIXTURE.plaintext);
  });

  it("encodes the same envelope shape the library produced", () => {
    const produced = encryptString(COMPAT_FIXTURE.plaintext, RAW_KEY, COMPAT_FIXTURE.fingerprint);
    const [version, algorithm, fingerprint, iv, ciphertext] = produced.split(".");

    expect(produced.split(".")).toHaveLength(5);
    expect(version).toBe("v1");
    expect(algorithm).toBe("aesgcm256");
    expect(fingerprint).toBe(COMPAT_FIXTURE.fingerprint);
    expect(iv).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(ciphertext).toMatch(/^[A-Za-z0-9_-]{22,}={0,2}$/);
  });

  it("round-trips arbitrary unicode payloads", () => {
    const plaintext = "Ünïcødé — 日本語 — emoji 🎯 — <script>alert(1)</script>";

    expect(decryptString(encryptString(plaintext, RAW_KEY, "deadbeef"), RAW_KEY)).toBe(plaintext);
  });

  it("produces a distinct ciphertext each call (random IV)", () => {
    const a = encryptString("same", RAW_KEY, "deadbeef");
    const b = encryptString("same", RAW_KEY, "deadbeef");

    expect(a).not.toBe(b);
  });

  it("rejects a tampered ciphertext via the GCM auth tag", () => {
    const produced = encryptString("secret", RAW_KEY, "deadbeef");
    const parsed = parseEncryptedString(produced);
    if (parsed === false) {
      throw new Error("expected a valid envelope");
    }
    const bytes = Buffer.from(parsed.ciphertext, "base64url");
    bytes[0] = (bytes[0] ?? 0) ^ 0xff;
    const tampered = encodeEncryptedString(
      parsed.fingerprint,
      Buffer.from(parsed.iv, "base64url"),
      bytes,
    );

    expect(() => decryptString(tampered, RAW_KEY)).toThrow(/unable to authenticate/);
  });

  it("does not treat plain values as encrypted", () => {
    for (const plain of ["", "user@example.com", "a.b.c", "12345", "v1.aesgcm256.short"]) {
      expect(looksEncrypted(plain)).toBe(false);
    }

    expect(looksEncrypted(COMPAT_FIXTURE.ciphertext)).toBe(true);
    expect(looksEncrypted(42)).toBe(false);
    expect(looksEncrypted(null)).toBe(false);
  });

  it("round-trips a payload large enough to span the decipher chunk boundary", () => {
    const plaintext = "é".repeat(20_000);

    expect(decryptString(encryptString(plaintext, RAW_KEY, "deadbeef"), RAW_KEY)).toBe(plaintext);
  });
});
