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

// Hash columns are credential-equivalent too: a sha256 of a normalized email can be brute-forced.
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

// Byte-compatible with `prisma-field-encryption`'s `hashString`: append the salt only when one is configured, because appending an absent salt as `"undefined"` would not match the stored rows.
export function hashValue(value: string, normalize: Array<"lowercase" | "trim">): string {
  let normalized = value;

  if (normalize.includes("lowercase")) {
    normalized = normalized.toLowerCase();
  }

  if (normalize.includes("trim")) {
    normalized = normalized.trim();
  }

  const hash = crypto.createHash("sha256").update(normalized, "utf8");

  if (PRISMA_FIELD_ENCRYPTION_HASH_SALT) {
    hash.update(PRISMA_FIELD_ENCRYPTION_HASH_SALT, "utf8");
  }

  return hash.digest("hex");
}

export function getHashFieldName(field: string): string {
  return `${field}Hash`;
}
