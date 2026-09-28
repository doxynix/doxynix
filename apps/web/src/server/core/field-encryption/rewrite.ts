import { decryptString, encryptString, looksEncrypted, parseEncryptedString } from "./cipher";
import { type FieldSpec, getHashFieldName, getModelSpec, hashValue } from "./config";
import { findKeyForMessage, type Keychain } from "./keyring";
import { type TreeNode, traverseTree } from "./traverse";

/** `{ field: { equals | not | set: value } }` wrappers Prisma accepts on input. */
const INPUT_SUB_FIELDS = ["equals", "not", "set"] as const;
/** Clauses that must compare against the deterministic hash column instead. */
const HASH_CLAUSES = ["connect", "cursor", "where"];
const SORT_DIRECTIONS = new Set(["asc", "desc"]);

type ModelState = { model: string };

/** One encrypted value found in the input tree, with the model it belongs to. */
type Target = {
  field: string;
  fieldSpec: FieldSpec;
  model: string;
  path: string[];
  value: string;
};

export type HashConfig = NonNullable<FieldSpec["hash"]>;

export function encryptOnWrite(
  args: Record<string, unknown>,
  model: string,
  key: { fingerprint: string; raw: Buffer },
): Record<string, unknown> {
  // No fast path here, unlike the read side: a model with no encrypted fields of
  // its own can still own a relation that has them (`Analysis` -> `Document.content`,
  // `ChatSession` -> `ChatMessage.parts`), so the tree always has to be walked.
  const draft = structuredClone(args);

  for (const target of collectTargets(draft, model)) {
    rewriteTarget(draft, target, key);
  }

  return draft;
}

export function decryptOnRead(
  result: unknown,
  model: string,
  hasIncludeOrSelect: boolean,
  keychain: Keychain,
  onError: (message: string) => void,
): void {
  if (Object.keys(getModelSpec(model).fields).length === 0 && !hasIncludeOrSelect) {
    return;
  }

  traverseTree<ModelState>(
    result,
    (state, node) => {
      const nodeSpec = getModelSpec(state.model);

      if (
        Object.hasOwn(nodeSpec.fields, node.key) &&
        node.type === "string" &&
        looksEncrypted(node.value)
      ) {
        const clearText = safeDecrypt(node.value, state.model, node.key, keychain, onError);

        if (clearText != null) {
          writePath(result, node.path, clearText);
        }
      }

      return nextModel(state, node, nodeSpec);
    },
    { model },
  );
}

// -- input side --

/**
 * Single pass over the whole `args` tree, following relations so nested writes
 * such as `data.accounts.create.accessToken` are visited against the right
 * model. Rewrites are applied afterwards so the walk never reads a tree it is
 * concurrently mutating.
 */
function collectTargets(draft: Record<string, unknown>, model: string): Target[] {
  const targets: Target[] = [];

  traverseTree<ModelState>(
    draft,
    (state, node) => {
      const nodeSpec = getModelSpec(state.model);

      if (Object.hasOwn(nodeSpec.fields, node.key)) {
        // `Object.hasOwn` rather than `in`: `noUncheckedIndexedAccess` makes the
        // lookup `FieldSpec | undefined`, and `in` would also match inherited
        // members such as `toString`.
        const fieldSpec = nodeSpec.fields[node.key];

        if (fieldSpec == null) {
          return nextModel(state, node, nodeSpec);
        }

        if (node.type === "string" && typeof node.value === "string") {
          targets.push({
            field: node.key,
            fieldSpec,
            model: state.model,
            path: node.path,
            value: node.value,
          });
          return state;
        }

        if (node.type === "object") {
          const wrapper = node.value as Record<string, unknown>;

          for (const subField of INPUT_SUB_FIELDS) {
            const nested = wrapper[subField];

            if (typeof nested === "string") {
              targets.push({
                field: node.key,
                fieldSpec,
                model: state.model,
                path: [...node.path, subField],
                value: nested,
              });
            }
          }
        }

        return state;
      }

      return nextModel(state, node, nodeSpec);
    },
    { model },
  );

  return targets;
}

function rewriteTarget(
  draft: Record<string, unknown>,
  target: Target,
  key: { fingerprint: string; raw: Buffer },
): void {
  const { fieldSpec } = target;
  const fieldPath = fieldPathOf(target.path);
  const hashPath = siblingPath(fieldPath, getHashFieldName(target.field));

  // Searching an encrypted column is meaningless: swap it for the hash column
  // and drop the wrapper, so `where.email.equals` becomes `where.emailHash`.
  if (fieldSpec.hash != null && isHashClausePath(target.path)) {
    writePath(draft, hashPath, hashFor(target.value, fieldSpec));
    deletePath(draft, fieldPath);
    return;
  }

  // Sorting ciphertext is meaningless, and `'asc' | 'desc'` must not be encrypted.
  if (isOrderByPath(target.path, target.value)) {
    deletePath(draft, target.path);
    return;
  }

  // A `{ field: { set | equals | not: value } }` wrapper is replaced wholesale:
  // the encrypted column is a scalar and cannot hold a nested operator.
  writePath(draft, fieldPath, encryptString(target.value, key.raw, key.fingerprint));

  if (fieldSpec.hash != null) {
    writePath(draft, hashPath, hashFor(target.value, fieldSpec));
  }
}

function hashFor(value: string, fieldSpec: FieldSpec): string {
  return hashValue(value, fieldSpec.hash?.normalize ?? []);
}

/** The path of the field itself, with any `{ set | equals | not }` wrapper stripped. */
function fieldPathOf(path: string[]): string[] {
  return isSubField(last(path)) ? path.slice(0, -1) : path;
}

/** The hash column is a sibling of the encrypted column, not a child of it. */
function siblingPath(fieldPath: string[], name: string): string[] {
  return [...fieldPath.slice(0, -1), name];
}

function isSubField(segment: string | undefined): boolean {
  return segment != null && (INPUT_SUB_FIELDS as readonly string[]).includes(segment);
}

/** Mirrors the library's `rewriteHashedFieldPath` + `rewriteWritePath` clause set. */
function isHashClausePath(path: string[]): boolean {
  const items = fieldPathOf(path);
  return HASH_CLAUSES.some((clause) => items.includes(clause));
}

/** Mirrors the library's `isOrderBy`. */
function isOrderByPath(path: string[], value: string): boolean {
  return path.includes("orderBy") && SORT_DIRECTIONS.has(value.toLowerCase());
}

function last(items: string[]): string | undefined {
  return items.at(-1);
}

// -- shared helpers --

function safeDecrypt(
  value: string,
  model: string,
  field: string,
  keychain: Keychain,
  onError: (message: string) => void,
): null | string {
  try {
    const parsed = parseEncryptedString(value);
    if (parsed === false) {
      return null;
    }
    return decryptString(value, findKeyForMessage(parsed.fingerprint, keychain).raw);
  } catch (error) {
    onError(
      `[field-encryption] Failed to decrypt ${model}.${field}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
}

function nextModel(
  state: ModelState,
  node: TreeNode,
  spec: { connections: Record<string, string> },
): ModelState {
  if ((node.type === "object" || node.type === "array") && node.key in spec.connections) {
    const target = spec.connections[node.key];
    if (target != null) {
      return { model: target };
    }
  }
  return state;
}

function readPath(root: unknown, path: string[]): unknown {
  return path.reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== "object") {
      return undefined;
    }
    return (acc as Record<string, unknown>)[key];
  }, root);
}

function writePath(root: unknown, path: string[], value: unknown): void {
  const keys = [...path];
  const final = keys.pop();
  if (final == null) {
    return;
  }
  let cursor = root as Record<string, unknown> | undefined;
  for (const key of keys) {
    const next = cursor?.[key];
    if (next == null || typeof next !== "object") {
      return;
    }
    cursor = next as Record<string, unknown>;
  }
  if (cursor != null) {
    cursor[final] = value;
  }
}

function deletePath(root: unknown, path: string[]): void {
  const keys = [...path];
  const final = keys.pop();
  if (final == null) {
    return;
  }
  const parent = readPath(root, keys);
  if (parent != null && typeof parent === "object") {
    delete (parent as Record<string, unknown>)[final];
  }
}
