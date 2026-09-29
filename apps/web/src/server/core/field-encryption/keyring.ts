import { type ParsedKey, parseKey } from "./key-internal";

export type { ParsedKey } from "./key-internal";
export { fingerprintOf, parseKey } from "./key-internal";

export type Keychain = Record<string, ParsedKey>;

export function makeKeychain(keys: readonly string[]): Keychain {
  const keychain: Keychain = {};

  for (const key of keys) {
    const parsed = parseKey(key);
    keychain[parsed.fingerprint] = parsed;
  }

  return keychain;
}

export function findKeyForMessage(fingerprint: string, keychain: Keychain): ParsedKey {
  const found = keychain[fingerprint];

  if (found == null) {
    throw new Error(
      `[field-encryption] No key available for fingerprint ${fingerprint}. ` +
        "Add it to PRISMA_FIELD_ENCRYPTION_DECRYPTION_KEYS.",
    );
  }

  return found;
}
