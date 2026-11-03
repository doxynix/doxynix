import { decryptString, encryptString, looksEncrypted, parseEncryptedString } from "./cipher";
import { type FieldSpec, getHashFieldName, getModelSpec, hashValue } from "./config";
import { findKeyForMessage, type Keychain } from "./keyring";
import { type TreeNode, traverseTree } from "./traverse";

const HASH_FILTER_OPERATORS: readonly string[] = ["equals", "in", "not", "notIn"];
const UNSUPPORTED_FILTER_OPERATORS = [
  "contains",
  "endsWith",
  "gt",
  "gte",
  "lt",
  "lte",
  "search",
  "startsWith",
] as const;
// Clauses that must compare against the deterministic hash column instead.
const HASH_CLAUSES = ["connect", "cursor", "where"];
const SORT_DIRECTIONS = new Set(["asc", "desc"]);

type ModelState = { model: string };

type Operator = "direct" | "equals" | "in" | "not" | "notIn" | "set";

type Target = {
  field: string;
  fieldPath: string[];
  fieldSpec: FieldSpec;
  model: string;
  operator: Operator;
  value: string | string[];
};

export type HashConfig = NonNullable<FieldSpec["hash"]>;

export function encryptOnWrite(
  args: Record<string, unknown>,
  model: string,
  key: { fingerprint: string; raw: Buffer },
): Record<string, unknown> {
  // No fast path here, unlike the read side: a model with no encrypted fields of its own can still own a relation that has them (`Analysis` -> `Document.content`).
  const draft = cloneForRewrite(args);

  for (const target of collectTargets(draft, model)) {
    rewriteTarget(draft, target, key);
  }

  return draft;
}

// `structuredClone` reduces Prisma's `DbNull`/`JsonNull` markers to `{}`, which writes JSON `{}`
// instead of SQL NULL, and turns `Buffer`/`Decimal` into plain objects. Only plain objects and
// arrays need copying, so other class instances are passed through by reference.
function cloneForRewrite<T>(value: T, seen: WeakMap<object, unknown> = new WeakMap()): T {
  if (Array.isArray(value)) {
    const cached = seen.get(value);

    if (cached != null) {
      return cached as T;
    }

    const copy: unknown[] = [];
    seen.set(value, copy);

    for (const item of value) {
      copy.push(cloneForRewrite(item, seen));
    }

    return copy as T;
  }

  if (value == null || typeof value !== "object") {
    return value;
  }

  const prototype = Object.getPrototypeOf(value);

  // `Object.create(null)` maps are plain data; every other class instance is passed through.
  if (prototype !== Object.prototype && prototype !== null) {
    return value;
  }

  const cached = seen.get(value);

  if (cached != null) {
    return cached as T;
  }

  const copy: Record<string, unknown> = {};
  seen.set(value, copy);

  for (const [key, nested] of Object.entries(value)) {
    // `defineProperty` keeps an own `__proto__` key instead of triggering the prototype setter.
    Object.defineProperty(copy, key, {
      configurable: true,
      enumerable: true,
      value: cloneForRewrite(nested, seen),
      writable: true,
    });
  }

  return copy as T;
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

// Collects targets in one pass, following relations so nested writes are visited against the right model; rewrites run afterwards so the walk never reads a tree it is concurrently mutating.
function collectTargets(draft: Record<string, unknown>, model: string): Target[] {
  const targets: Target[] = [];

  traverseTree<ModelState>(
    draft,
    (state, node) => {
      const nodeSpec = getModelSpec(state.model);

      if (!Object.hasOwn(nodeSpec.fields, node.key)) {
        return nextModel(state, node, nodeSpec);
      }

      const fieldSpec = nodeSpec.fields[node.key];

      if (fieldSpec == null) {
        return nextModel(state, node, nodeSpec);
      }

      if (node.type === "string" && typeof node.value === "string") {
        targets.push({
          field: node.key,
          fieldPath: node.path,
          fieldSpec,
          model: state.model,
          operator: "direct",
          value: node.value,
        });
        return state;
      }

      if (node.type === "object" && isPlainRecord(node.value)) {
        collectWrapperTargets(
          targets,
          state.model,
          node.key,
          node.path,
          fieldSpec,
          node.value,
          isHashClausePath(node.path),
        );
        return state;
      }

      return state;
    },
    { model },
  );

  return targets;
}

function collectWrapperTargets(
  targets: Target[],
  model: string,
  field: string,
  fieldPath: string[],
  fieldSpec: FieldSpec,
  wrapper: Record<string, unknown>,
  allowFilters: boolean,
): void {
  for (const [operator, raw] of Object.entries(wrapper)) {
    if (operator === "set") {
      if (typeof raw === "string") {
        targets.push({ field, fieldPath, fieldSpec, model, operator: "set", value: raw });
      }
      continue;
    }

    if (!allowFilters) {
      continue;
    }

    if (operator === "mode") {
      assertModeSupported(model, field, fieldSpec, raw);
      continue;
    }

    if (operator === "equals") {
      if (raw == null) {
        continue;
      }
      if (typeof raw !== "string") {
        throw new Error(`[field-encryption] ${model}.${field}.equals must be a string`);
      }
      targets.push({ field, fieldPath, fieldSpec, model, operator: "equals", value: raw });
      continue;
    }

    if (operator === "not") {
      if (raw == null) {
        continue;
      }
      if (typeof raw === "string") {
        targets.push({ field, fieldPath, fieldSpec, model, operator: "not", value: raw });
        continue;
      }
      if (isPlainRecord(raw)) {
        collectNotObject(targets, model, field, fieldPath, fieldSpec, raw);
        continue;
      }
      throw new Error(
        `[field-encryption] ${model}.${field}.not must be a string or a nested filter object`,
      );
    }

    if (operator === "in" || operator === "notIn") {
      if (raw == null) {
        continue;
      }
      if (!isStringArray(raw)) {
        throw new Error(
          `[field-encryption] ${model}.${field}.${operator} must be an array of strings`,
        );
      }
      targets.push({
        field,
        fieldPath,
        fieldSpec,
        model,
        operator: operator,
        value: raw,
      });
      continue;
    }

    if (isUnsupportedFilterOperator(operator)) {
      throw unsupportedOperator(model, field, operator);
    }
  }
}

function collectNotObject(
  targets: Target[],
  model: string,
  field: string,
  fieldPath: string[],
  fieldSpec: FieldSpec,
  nested: Record<string, unknown>,
): void {
  const entries = Object.entries(nested);

  if (entries.length === 0) {
    return;
  }

  if (entries.length !== 1) {
    throw new Error(`[field-encryption] ${model}.${field}.not must contain exactly one operator`);
  }

  const [operator, raw] = entries[0] as [string, unknown];

  if (raw == null) {
    return;
  }

  if (operator === "equals") {
    if (typeof raw !== "string") {
      throw new Error(`[field-encryption] ${model}.${field}.not.equals must be a string`);
    }
    targets.push({ field, fieldPath, fieldSpec, model, operator: "not", value: raw });
    return;
  }

  if (operator === "in") {
    if (!isStringArray(raw)) {
      throw new Error(`[field-encryption] ${model}.${field}.not.in must be an array of strings`);
    }
    targets.push({ field, fieldPath, fieldSpec, model, operator: "notIn", value: raw });
    return;
  }

  if (operator === "notIn") {
    if (!isStringArray(raw)) {
      throw new Error(`[field-encryption] ${model}.${field}.not.notIn must be an array of strings`);
    }
    targets.push({ field, fieldPath, fieldSpec, model, operator: "in", value: raw });
    return;
  }

  if (operator === "not") {
    throw new Error(
      `[field-encryption] ${model}.${field}.not.not is not supported; simplify the filter`,
    );
  }

  if (isUnsupportedFilterOperator(operator)) {
    throw unsupportedOperator(model, field, operator);
  }

  throw new Error(
    `[field-encryption] ${model}.${field}.not has unsupported operator "${operator}"`,
  );
}

function assertModeSupported(
  model: string,
  field: string,
  fieldSpec: FieldSpec,
  raw: unknown,
): void {
  if (raw == null || raw === "default") {
    return;
  }

  if (raw !== "insensitive") {
    throw new Error(`[field-encryption] ${model}.${field}.mode must be "insensitive" or "default"`);
  }

  if (fieldSpec.hash == null || !fieldSpec.hash.normalize.includes("lowercase")) {
    throw new Error(
      `[field-encryption] ${model}.${field} uses mode "insensitive" but its hash is not lowercase-normalized`,
    );
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isUnsupportedFilterOperator(operator: string): boolean {
  return (UNSUPPORTED_FILTER_OPERATORS as readonly string[]).includes(operator);
}

function unsupportedOperator(model: string, field: string, operator: string): Error {
  return new Error(
    `[field-encryption] Unsupported filter operator "${operator}" on hashed field ${model}.${field}. ` +
      `Supported: ${HASH_FILTER_OPERATORS.join(", ")}.`,
  );
}

function rewriteTarget(
  draft: Record<string, unknown>,
  target: Target,
  key: { fingerprint: string; raw: Buffer },
): void {
  const { fieldSpec, fieldPath } = target;
  const hashPath = siblingPath(fieldPath, getHashFieldName(target.field));

  if (isHashClausePath(fieldPath)) {
    if (fieldSpec.hash == null) {
      throw new Error(
        `[field-encryption] ${target.model}.${target.field} has no hash column; ` +
          "filtering by ciphertext cannot match. Add @encryption:hash(...) or remove the filter.",
      );
    }

    writeHashTarget(draft, hashPath, target);
    deletePath(draft, fieldPath);
    return;
  }

  // Sorting ciphertext is meaningless, and `'asc' | 'desc'` must not be encrypted.
  if (
    target.operator === "direct" &&
    typeof target.value === "string" &&
    isOrderByPath(fieldPath, target.value)
  ) {
    deletePath(draft, fieldPath);
    return;
  }

  if (target.operator !== "direct" && target.operator !== "set") {
    return;
  }

  const plaintext = target.value as string;
  writePath(draft, fieldPath, encryptString(plaintext, key.raw, key.fingerprint));

  if (fieldSpec.hash != null) {
    writePath(draft, hashPath, hashFor(plaintext, fieldSpec));
  }
}

function writeHashTarget(draft: Record<string, unknown>, hashPath: string[], target: Target): void {
  if (target.operator === "direct") {
    writePath(draft, hashPath, hashFor(target.value as string, target.fieldSpec));
    return;
  }

  if (target.operator === "set") {
    throw new Error(
      `[field-encryption] ${target.model}.${target.field}.set is not a filter operator`,
    );
  }

  if (target.operator === "in" || target.operator === "notIn") {
    writeNestedPath(
      draft,
      [...hashPath, target.operator],
      (target.value as string[]).map((value) => hashFor(value, target.fieldSpec)),
    );
    return;
  }

  writeNestedPath(
    draft,
    [...hashPath, target.operator],
    hashFor(target.value as string, target.fieldSpec),
  );
}

// `writePath` only walks existing objects; hash operators such as `not` need a new
// `{ fieldHash: { not: ... } }` wrapper, so this variant creates missing intermediates.
function writeNestedPath(root: unknown, path: string[], value: unknown): void {
  const keys = [...path];
  const final = keys.pop();

  if (final == null) {
    return;
  }

  let cursor = root as Record<string, unknown> | undefined;

  for (const key of keys) {
    if (cursor == null) {
      return;
    }

    const next = cursor[key];

    if (next != null && typeof next === "object") {
      cursor = next as Record<string, unknown>;
      continue;
    }

    const created: Record<string, unknown> = {};
    cursor[key] = created;
    cursor = created;
  }

  if (cursor != null) {
    cursor[final] = value;
  }
}

function hashFor(value: string, fieldSpec: FieldSpec): string {
  return hashValue(value, fieldSpec.hash?.normalize ?? []);
}

// The hash column is a sibling of the encrypted column, not a child of it.
function siblingPath(fieldPath: string[], name: string): string[] {
  return [...fieldPath.slice(0, -1), name];
}

function isHashClausePath(fieldPath: string[]): boolean {
  return HASH_CLAUSES.some((clause) => fieldPath.includes(clause));
}

// Mirrors the library's `isOrderBy`.
function isOrderByPath(fieldPath: string[], value: string): boolean {
  return fieldPath.includes("orderBy") && SORT_DIRECTIONS.has(value.toLowerCase());
}

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
