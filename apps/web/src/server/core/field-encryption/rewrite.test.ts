import { describe, expect, it, vi } from "vitest";

import { encryptString, parseEncryptedString } from "./cipher";
import { hashValue } from "./config";
import { findKeyForMessage, makeKeychain, parseKey } from "./keyring";
import { decryptOnRead, encryptOnWrite } from "./rewrite";

vi.mock("@/shared/config/env.server", () => ({
  PRISMA_FIELD_ENCRYPTION_HASH_SALT: "unit-test-salt",
}));

const KEY = `k1.aesgcm256.${Buffer.from("0123456789abcdef0123456789abcdef").toString("base64url")}`;
const parsedKey = parseKey(KEY);

const at = (root: unknown, ...keys: string[]): Record<string, unknown> => {
  let cursor: unknown = root;
  for (const key of keys) {
    expect(cursor).toBeTypeOf("object");
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor as Record<string, unknown>;
};

describe("encryptOnWrite", () => {
  it("encrypts a plaintext field on create", () => {
    const out = encryptOnWrite({ data: { email: "user@example.com" } }, "User", parsedKey);

    const value = (out.data as Record<string, unknown>).email;
    expect(typeof value).toBe("string");
    expect(parseEncryptedString(value as string)).not.toBe(false);
    expect(value).not.toBe("user@example.com");
  });

  it("also writes the hash field so lookups keep working", () => {
    const out = encryptOnWrite({ data: { email: "User@Example.com" } }, "User", parsedKey);

    expect((out.data as Record<string, unknown>).emailHash).toBe(
      hashValue("User@Example.com", ["lowercase", "trim"]),
    );
  });

  it("encrypts a field on update", () => {
    const out = encryptOnWrite({ data: { content: "notes" } }, "Document", parsedKey);

    expect(parseEncryptedString((out.data as Record<string, unknown>).content as string)).not.toBe(
      false,
    );
  });

  it("rewrites where.email.equals into where.emailHash", () => {
    const out = encryptOnWrite(
      { where: { email: { equals: "user@example.com" } } },
      "User",
      parsedKey,
    );

    const where = out.where as Record<string, unknown>;
    expect(where.email).toBeUndefined();
    expect(where.emailHash).toBe(hashValue("user@example.com", ["lowercase", "trim"]));
  });

  it("rewrites a bare where.email comparison too", () => {
    const out = encryptOnWrite({ where: { email: "user@example.com" } }, "User", parsedKey);

    expect((out.where as Record<string, unknown>).emailHash).toBe(
      hashValue("user@example.com", ["lowercase", "trim"]),
    );
  });

  it("drops orderBy on an encrypted field because ciphertext cannot be sorted", () => {
    const out = encryptOnWrite({ orderBy: { email: "asc" } }, "User", parsedKey);

    // Removal leaves an empty but Prisma-valid `orderBy`, matching the previous object-path.del behavior.
    expect(out.orderBy).toEqual({});
  });

  it("leaves the input object untouched", () => {
    const args = { data: { email: "user@example.com" } };

    encryptOnWrite(args, "User", parsedKey);

    expect(args.data.email).toBe("user@example.com");
  });

  it("ignores models with no encrypted fields", () => {
    const args = { data: { name: "Repo" } };

    expect(encryptOnWrite(args, "Repo", parsedKey)).toEqual(args);
  });

  it("encrypts an encrypted field reached through a nested relation write", () => {
    // `Account` has no encrypted fields of its own, but `User` does, so the walk must follow `data.accounts.create`.
    const out = encryptOnWrite(
      { data: { accounts: { create: { accessToken: "tok", email: "acct@example.com" } } } },
      "User",
      parsedKey,
    );
    const account = at(out, "data", "accounts", "create");

    expect(parseEncryptedString(account.accessToken as string)).not.toBe(false);
    expect(parseEncryptedString(account.email as string)).not.toBe(false);
    expect(account.emailHash).toBe(hashValue("acct@example.com", ["lowercase", "trim"]));
  });

  it("follows a relation from a model with no encrypted fields of its own", () => {
    // `Analysis` has no encrypted fields, but `Document.content` is encrypted, so an early exit there would write the document in plaintext.
    const out = encryptOnWrite(
      { data: { documents: { create: { content: "secret body" } } } },
      "Analysis",
      parsedKey,
    );
    const document = at(out, "data", "documents", "create");

    expect(parseEncryptedString(document.content as string)).not.toBe(false);
  });

  it("rewrites a where clause nested under a relation", () => {
    const out = encryptOnWrite(
      { where: { accounts: { some: { email: "acct@example.com" } } } },
      "User",
      parsedKey,
    );
    const some = at(out, "where", "accounts", "some");

    expect(some.email).toBeUndefined();
    expect(some.emailHash).toBe(hashValue("acct@example.com", ["lowercase", "trim"]));
  });
});

describe("decryptOnRead", () => {
  const keychain = makeKeychain([KEY]);

  it("decrypts an encrypted field back to plaintext", () => {
    const value = encryptString("user@example.com", parsedKey.raw, parsedKey.fingerprint);
    const result = { email: value, id: "u1" };

    decryptOnRead(result, "User", true, keychain, () => {});

    expect(result.email).toBe("user@example.com");
    expect(result.id).toBe("u1");
  });

  it("leaves plaintext values alone instead of failing to decrypt them", () => {
    const result = { email: "already-plain@example.com" };

    decryptOnRead(result, "User", true, keychain, () => {});

    expect(result.email).toBe("already-plain@example.com");
  });

  it("skips work entirely when the model is untouched and nothing is included", () => {
    const result = { id: "r1" };

    decryptOnRead(result, "Repo", false, keychain, () => {});

    expect(result).toEqual({ id: "r1" });
  });

  it("reports a missing key instead of silently returning ciphertext", () => {
    const foreign = `k1.aesgcm256.${Buffer.from("ffffffffffffffffffffffffffffffff").toString("base64url")}`;
    const value = encryptString("secret", parseKey(foreign).raw, parseKey(foreign).fingerprint);
    const errors: string[] = [];

    decryptOnRead({ email: value }, "User", true, keychain, (m) => errors.push(m));

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/No key available/);

    const held: { email: string } = { email: value };
    decryptOnRead(held, "User", true, keychain, () => {});
    expect(held.email).toBe(value);
  });

  it("decrypts through an included relation", () => {
    const result = {
      accounts: [{ accessToken: encryptString("tok", parsedKey.raw, parsedKey.fingerprint) }],
      email: encryptString("me@example.com", parsedKey.raw, parsedKey.fingerprint),
    };

    decryptOnRead(result, "User", true, keychain, () => {});

    const [firstAccount] = result.accounts;

    expect(result.email).toBe("me@example.com");
    expect(firstAccount?.accessToken).toBe("tok");
  });

  it("resolves the rotation key from the message fingerprint", () => {
    const oldKey = `k1.aesgcm256.${Buffer.from("11111111111111111111111111111111").toString("base64url")}`;
    const oldParsed = parseKey(oldKey);
    const rotated = makeKeychain([KEY, oldKey]);
    const value = encryptString("legacy", oldParsed.raw, oldParsed.fingerprint);
    const result = { email: value };

    decryptOnRead(result, "User", true, rotated, () => {});

    expect(result.email).toBe("legacy");
    expect(findKeyForMessage(oldParsed.fingerprint, rotated).fingerprint).toBe(
      oldParsed.fingerprint,
    );
  });
});
