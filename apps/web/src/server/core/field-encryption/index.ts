import { buildFieldEncryptionExtension } from "./extension";

export type FieldEncryptionConfig = {
  decryptionKeys?: readonly string[];
  encryptionKey: string;
};

/**
 * Returns the `Prisma.defineExtension(...)` hook verbatim. The return type is
 * inferred on purpose - see the note in `extension.ts`.
 */
export function fieldEncryptionExtension(config: FieldEncryptionConfig) {
  const { extension } = buildFieldEncryptionExtension(config);
  return extension;
}
