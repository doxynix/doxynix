import crypto from "node:crypto";

import { PRISMA_FIELD_ENCRYPTION_HASH_SALT } from "@/shared/config/env.server";

import { FIELD_ENCRYPTION_SPEC } from "./config.generated";

export type FieldSpec = {
  hash?: {
    normalize: Array<"lowercase" | "trim">;
  };
};

export type ModelSpec = {
  connections: Record<string, string>;
  fields: Record<string, FieldSpec>;
};

const EMPTY_SPEC: ModelSpec = { connections: {}, fields: {} };

export function getModelSpec(model: string): ModelSpec {
  return FIELD_ENCRYPTION_SPEC[model] ?? EMPTY_SPEC;
}

/**
 * Field names that must never reach an audit-log payload: the ciphertext
 * columns themselves plus their deterministic hash columns, which are
 * credential-equivalent (a sha256 of a normalized email can be brute-forced).
 */
export function getSensitiveFieldNames(model: string): Set<string> {
  const names = new Set<string>();

  for (const [field, spec] of Object.entries(getModelSpec(model).fields)) {
    names.add(field);

    if (spec.hash != null) {
      names.add(getHashFieldName(field));
    }
  }

  return names;
}

/**
 * Byte-compatible with `prisma-field-encryption`'s `hashString`: the library
 * streamed `update(normalized)` then `update(utf8(salt))`, which for SHA-256
 * is identical to hashing the concatenation.
 */
export function hashValue(value: string, normalize: Array<"lowercase" | "trim">): string {
  let normalized = value;

  if (normalize.includes("lowercase")) {
    normalized = normalized.toLowerCase();
  }

  if (normalize.includes("trim")) {
    normalized = normalized.trim();
  }

  return crypto
    .createHash("sha256")
    .update(`${normalized}${PRISMA_FIELD_ENCRYPTION_HASH_SALT}`, "utf8")
    .digest("hex");
}

export function getHashFieldName(field: string): string {
  return `${field}Hash`;
}
