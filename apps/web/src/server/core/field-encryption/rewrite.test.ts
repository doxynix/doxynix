import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { encryptString, parseEncryptedString } from "./cipher";
import { hashValue } from "./config";
import { parseKey } from "./key-internal";
import { findKeyForMessage, makeKeychain } from "./keyring";
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
    // nosemgrep: javascript.lang.security.audit.prototype-pollution.prototype-pollution-loop.prototype-pollution-loop — walks a local JSON fixture
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor as Record<string, unknown>;
};

describe("encryptOnWrite", () => {
  it("keeps Prisma null markers instead of collapsing them into empty JSON", () => {
    const out = encryptOnWrite({ data: { payload: Prisma.DbNull } }, "BillingEvent", parsedKey);

    expect((out.data as Record<string, unknown>).payload).toBe(Prisma.DbNull);
  });

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

  it("rewrites where.email.equals into where.emailHash.equals", () => {
    const out = encryptOnWrite(
      { where: { email: { equals: "user@example.com" } } },
      "User",
      parsedKey,
    );

    const where = out.where as Record<string, unknown>;
    expect(where.email).toBeUndefined();
    expect(where.emailHash).toEqual({
      equals: hashValue("user@example.com", ["lowercase", "trim"]),
    });
  });

  it("rewrites a bare where.email comparison too", () => {
    const out = encryptOnWrite({ where: { email: "user@example.com" } }, "User", parsedKey);

    expect((out.where as Record<string, unknown>).emailHash).toBe(
      hashValue("user@example.com", ["lowercase", "trim"]),
    );
  });

  it("rewrites an equality nested inside OR, which admin search relies on", () => {
    const out = encryptOnWrite(
      {
        where: {
          OR: [{ name: { contains: "karen" } }, { email: { equals: "karen@example.com" } }],
        },
      },
      "User",
      parsedKey,
    );

    const [first, second] = at(out, "where", "OR") as unknown as Array<Record<string, unknown>>;

    expect(first?.email).toBeUndefined();
    expect(second?.email).toBeUndefined();
    expect(second?.emailHash).toEqual({
      equals: hashValue("karen@example.com", ["lowercase", "trim"]),
    });
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

  it("clones null-prototype maps instead of mutating the caller's object", () => {
    const data = Object.assign(Object.create(null) as Record<string, unknown>, {
      email: "user@example.com",
    });

    const out = encryptOnWrite({ data }, "User", parsedKey) as {
      data: Record<string, unknown>;
    };

    expect(data.email).toBe("user@example.com");
    expect(out.data.email).not.toBe("user@example.com");
  });

  it("keeps class instances such as Buffer by reference", () => {
    const bytes = Buffer.from("abc");
    const out = encryptOnWrite(
      { data: { email: "user@example.com", resetToken: bytes } },
      "User",
      parsedKey,
    ) as {
      data: Record<string, unknown>;
    };

    expect(out.data.resetToken).toBe(bytes);
  });

  it("survives a cyclic args object", () => {
    const data: Record<string, unknown> = { email: "user@example.com" };
    data.self = data;

    const out = encryptOnWrite({ data }, "User", parsedKey) as {
      data: Record<string, unknown>;
    };

    expect(out.data.self).toBe(out.data);
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

describe("encryptOnWrite hashed filters", () => {
  const hashOf = (value: string) => hashValue(value, ["lowercase", "trim"]);

  it("preserves not instead of turning it into equality", () => {
    const out = encryptOnWrite(
      { where: { email: { not: "user@example.com" } } },
      "User",
      parsedKey,
    );

    expect(out.where).toEqual({ emailHash: { not: hashOf("user@example.com") } });
  });

  it("keeps equals and not as siblings on the hash field", () => {
    const out = encryptOnWrite(
      { where: { email: { equals: "a@example.com", not: "b@example.com" } } },
      "User",
      parsedKey,
    );

    expect(out.where).toEqual({
      emailHash: { equals: hashOf("a@example.com"), not: hashOf("b@example.com") },
    });
  });

  it("flattens not: { equals } to a negated hash comparison", () => {
    const out = encryptOnWrite(
      { where: { email: { not: { equals: "user@example.com" } } } },
      "User",
      parsedKey,
    );

    expect(out.where).toEqual({ emailHash: { not: hashOf("user@example.com") } });
  });

  it("hashes every element of in and notIn", () => {
    const out = encryptOnWrite(
      { where: { email: { in: ["a@example.com", "b@example.com"] } } },
      "User",
      parsedKey,
    );

    expect(out.where).toEqual({
      emailHash: { in: [hashOf("a@example.com"), hashOf("b@example.com")] },
    });
  });

  it("flattens not: { in } to notIn and not: { notIn } to in", () => {
    const [a, b] = ["a@example.com", "b@example.com"];

    expect(
      encryptOnWrite({ where: { email: { not: { in: [a, b] } } } }, "User", parsedKey).where,
    ).toEqual({ emailHash: { notIn: [hashOf(a), hashOf(b)] } });

    expect(
      encryptOnWrite({ where: { email: { not: { notIn: [a, b] } } } }, "User", parsedKey).where,
    ).toEqual({ emailHash: { in: [hashOf(a), hashOf(b)] } });
  });

  it("allows mode: insensitive only when the hash is lowercase-normalized", () => {
    const out = encryptOnWrite(
      { where: { email: { equals: "USER@Example.com", mode: "insensitive" } } },
      "User",
      parsedKey,
    );

    expect(out.where).toEqual({ emailHash: { equals: hashOf("USER@Example.com") } });

    expect(() =>
      encryptOnWrite(
        { where: { token: { equals: "x", mode: "insensitive" } } },
        "Session",
        parsedKey,
      ),
    ).toThrow(/mode "insensitive"/);
  });

  it("throws on operators a hash column cannot answer", () => {
    for (const operator of [
      "contains",
      "startsWith",
      "endsWith",
      "gt",
      "gte",
      "lt",
      "lte",
      "search",
    ]) {
      expect(() =>
        encryptOnWrite({ where: { email: { [operator]: "x" } } }, "User", parsedKey),
      ).toThrow(new RegExp(`Unsupported filter operator "${operator}"`));
    }
  });

  it("throws instead of hashing a filter on a field without a hash column", () => {
    expect(() => encryptOnWrite({ where: { content: "secret" } }, "Document", parsedKey)).toThrow(
      /has no hash column/,
    );
  });

  it("leaves null filters on encrypted columns alone", () => {
    const args = { where: { accessToken: { not: null } } };

    expect(encryptOnWrite(args, "Account", parsedKey)).toEqual(args);
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
