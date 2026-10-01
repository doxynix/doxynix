import { buildFieldEncryptionExtension } from "./extension";

export type FieldEncryptionConfig = {
  decryptionKeys?: readonly string[];
  encryptionKey: string;
};

// Return type is deliberately inferred - see the note in `extension.ts`.
export function fieldEncryptionExtension(config: FieldEncryptionConfig) {
  const { extension } = buildFieldEncryptionExtension(config);
  return extension;
}
