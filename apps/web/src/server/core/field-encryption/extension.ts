import { Prisma } from "@prisma/client";

import { type Keychain, makeKeychain, type ParsedKey, parseKey } from "./keyring";
import { decryptOnRead, encryptOnWrite } from "./rewrite";

export type FieldEncryptionKeys = {
  key: ParsedKey;
  keychain: Keychain;
};

// `Prisma.defineExtension` types `$allOperations` as a union across every model and
// operation, so `query` cannot be called; pinning the handler shape fixes that
// without an `any` cast in db.ts.
type AllOperationsArgs = {
  args: Record<string, unknown>;
  model?: null | string;
  operation: string;
  query: (args: unknown) => Promise<unknown>;
};

// Return type is deliberately inferred: annotating it as `ReturnType<typeof Prisma.defineExtension>` erases `PrismaClientExtends<...>` and makes `client.$extends(extension)` resolve to `unknown`, poisoning every `tx`/`prisma` type.
export function buildFieldEncryptionExtension(config: {
  decryptionKeys?: readonly string[];
  encryptionKey: string;
}) {
  if (config.encryptionKey.length === 0) {
    throw new Error(
      "[field-encryption] No encryption key configured. Set PRISMA_FIELD_ENCRYPTION_KEY.",
    );
  }

  const key = parseKey(config.encryptionKey);
  const keychain = makeKeychain([config.encryptionKey, ...(config.decryptionKeys ?? [])]);

  return {
    extension: Prisma.defineExtension({
      name: "field-encryption",
      query: {
        $allModels: {
          async $allOperations({ args, model, operation, query }: AllOperationsArgs) {
            if (model == null) {
              return query(args);
            }

            const encryptedArgs = encryptOnWrite(args, model, key);
            const result = await query(encryptedArgs);
            const hasIncludeOrSelect =
              encryptedArgs.include != null || encryptedArgs.select != null;

            decryptOnRead(result, model, hasIncludeOrSelect, keychain, (message) => {
              // Matches the library: log and keep the ciphertext rather than throw.
              console.error(`[field-encryption] ${operation} ${model}: ${message}`);
            });

            return result;
          },
        },
      },
    }),
    keys: { key, keychain } satisfies FieldEncryptionKeys,
  };
}
