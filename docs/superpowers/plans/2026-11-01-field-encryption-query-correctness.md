# Field-Encryption Hashed-Filter Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make filters on hashed encrypted fields preserve Prisma semantics (`not`, `in`, `notIn`), reject operators that a hash column cannot answer instead of silently returning wrong rows, and align query-side hashing with the hash the extension actually stores.

**Architecture:** `rewrite.ts` stops treating every collected value as a plaintext `equals`: targets carry their field path and operator, hashed clauses write the sibling `*Hash` column while preserving `equals`/`not`/`in`/`notIn`, and unsupported operators fail loudly. `hash.ts` delegates to the same `hashValue` implementation the extension uses, removing the NFC drift between stored and queried `emailHash`/`identifierHash`. The two consumers that relied on substring matching of ciphertext — banned-email admin search and integration-test cleanup — move to decrypted in-memory filtering and `TRUNCATE users` respectively.

**Tech Stack:** TypeScript strict, Prisma 6 / ZenStack 2, Bun 1.4.3, Vitest 4, PostgreSQL test database.

**Spec:** this document, § Problem Statement. No separate design doc.

## Global Constraints

- Bun only. `npm`, `yarn`, `pnpm` are prohibited.
- Unit tests: `bun --filter @doxynix/web test <path>`. Integration tests: `bun --filter @doxynix/web test:int` (requires the disposable test DB and Doppler login).
- Keep byte compatibility with `prisma-field-encryption@1.6.0` / `@47ng/cloak@1.2.0`: do not change the cipher envelope, key fingerprint, hash algorithm, or normalization order.
- Do not hand-edit generated files: `apps/web/prisma/schema.prisma`, `apps/web/src/server/core/field-encryption/config.generated.ts`, `packages/shared/src/enums/index.ts`.
- No Prisma schema changes in this plan.
- Comments: English, maximum two lines, reason only. No ownerless `TODO`/`FIXME`.
- Run `bun run format` after each task. Final gate: `bun run validate`.
- Never use `--no-verify`.
- Pre-commit runs branch check, Biome, Oxlint, `arch:check`, cspell, secretlint. Use `fix(web):` / `test(web):` commit subjects.

---

## Problem Statement

The review that triggered this plan contained nine claims. Only four areas are real; the rest are false alarms or micro-optimizations. This plan implements only the real ones.

### Real problems

1. **`not` is inverted for hashed fields.**
   `encryptOnWrite({ where: { email: { not: "x" } } }, "User", key)` currently produces `where.emailHash = hash(x)` — a positive match. The wrapper is deleted in `rewrite.ts:193-197` and the operator is lost. Confirmed by running the function with the test key.

2. **`not: { equals }`, `in`, and `notIn` are not rewritten.**
   `not: { equals: "x" }` is valid Prisma (`NestedStringFilter`), but `collectTargets` only collects string values. `in`/`notIn` arrays are ignored. The query then compares ciphertext to plaintext: `not` returns all rows, `in` returns none, `notIn` returns all rows.

3. **Unsupported operators silently produce wrong results.**
   `contains`, `startsWith`, `endsWith`, `gt`, `gte`, `lt`, `lte`, and `search` are left on the encrypted column. `contains` can match random base64 characters in the envelope; range operators compare ciphertext lexicographically. Two real consumers rely on this today:
   - `bannedEmailService.buildWhereClause` uses `email: { contains: term, mode: "insensitive" }` on encrypted `BannedEmail.email`; admin substring search cannot match.
   - `src/tests/helpers.ts:66-70` deletes test users with `email: { contains: "@test.com" }`; this never matches ciphertext, so users accumulate between integration tests.

4. **Hash normalization drifted.**
   The extension writes `emailHash`/`identifierHash` through `hashValue`, which does lowercase + trim and **does not NFC-normalize**. Query sites use `getNormalizedHash`, which does trim + NFC + lowercase. For NFC/ASCII inputs they agree; for NFD Unicode emails the stored hash and the lookup hash differ, so the user is not found. `hash.test.ts:151-159` currently asserts NFC equivalence, which is the opposite of what storage does.

### Explicit non-goals

| Review claim | Why not in this plan |
| --- | --- |
| 1. `{ emailHash: "hash" }` is invalid Prisma / DMMF error | False. Scalar shorthand is valid in `WhereInput` (`StringFilter \| string`) and in `WhereUniqueInput` (unique fields are scalar). `prisma/seed.ts:358` and `auth/index.ts:73` already use it; the bare `where.email` test stays scalar. No change. |
| 2. `toReversed()` is a critical GC problem | It does copy one small array per collection, but `Object.entries` and `[...frame.path, key]` allocate at least as much. Not a correctness bug. Handle in a separate performance PR only if profiling shows GC pressure. |
| 3. Date/Decimal silently stored in plaintext | `field-encryption-generator.ts:59-63` throws at `db:generate` if `@encrypted` is not on a `String`. Encrypted columns are text. No change. |
| 4. `hashValue` normalize order is wrong | Generated config is `["lowercase", "trim"]` (`config.generated.ts:21`), and the library applies normalization in a fixed order regardless of array order. Iterating the array would diverge from the library. No change. |
| 6. `isHashClausePath` false positives | A field or relation literally named `where`/`connect`/`cursor` is contrived; model names never appear in paths, and the original library uses the same `includes` logic. No change. |
| 7. Base64 padding changes the fingerprint | Fingerprinting the serialized key text is the `@47ng/cloak` contract needed to decrypt existing rows. Changing it would break compatibility. This is an operational invariant, not a vulnerability. No change. |
| 8. Timing side-channel in `parseEncryptedString` | The function validates only attacker-supplied structure; it compares no secret. AES-GCM tag verification is constant-time inside OpenSSL. No change. |
| 9. `getSensitiveFieldNames` rebuilds a Set | One 1–5 element Set per audited mutation (`db.ts:193`), negligible next to the DB write. No change. |
| Cipher tag length | Already covered by `docs/superpowers/plans/2026-11-01-semgrep-adoption.md` Task 5. Do not duplicate here. |

### File structure

| File | Responsibility |
| --- | --- |
| `apps/web/src/server/core/field-encryption/rewrite.ts` | Typed target collection and operator-preserving hash rewrite. |
| `apps/web/src/server/core/field-encryption/rewrite.test.ts` | Unit tests for every supported/unsupported operator. |
| `apps/web/src/server/utils/hash.ts` | Prisma lookup hashes must delegate to the extension's `hashValue`. |
| `apps/web/src/server/utils/hash.test.ts` | Locks the no-NFC contract. |
| `apps/web/src/server/core/field-encryption/config.test.ts` | Locks `hashValue` ↔ `getNormalizedHash` agreement. |
| `apps/web/src/server/core/field-encryption/field-encryption.integration.test.ts` | Proves an NFD email writes the hash the query helper will use. |
| `apps/web/src/server/utils/search.ts` | Shared normalized substring matcher. |
| `apps/web/src/server/utils/search.test.ts` | NFC/NFD matcher tests. |
| `apps/web/src/server/modules/banned-emails/banned-email.service.ts` | Search after decryption, not on ciphertext. |
| `apps/web/src/server/modules/banned-emails/banned-email.service.test.ts` | Unit coverage for in-memory filtering/pagination. |
| `apps/web/src/tests/integration/banned-email.test.ts` | End-to-end proof against the real DB and extension. |
| `apps/web/src/tests/helpers.ts` | Truncate `users` instead of pattern-matching encrypted email. |

---

## Task 1: Lock the hashed-filter contract with failing tests

**Files:**
- Modify: `apps/web/src/server/core/field-encryption/rewrite.test.ts`

**Interfaces:**
- Consumes: existing `parsedKey`, `encryptOnWrite`, `hashValue`.
- Produces: failing tests that define the expected output shape for Task 2.

- [ ] **Step 1: Add the regression tests**

Append this block after the existing `describe("encryptOnWrite", ...)` block in `rewrite.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test file and confirm the new tests fail**

Run:

```bash
bun --filter @doxynix/web test src/server/core/field-encryption/rewrite.test.ts
```

Expected: existing tests pass; the new `not`/`in`/`notIn`/`contains`/`no hash` tests fail. Do not change production code yet.

- [ ] **Step 3: Commit the failing tests**

```bash
git add apps/web/src/server/core/field-encryption/rewrite.test.ts
git commit -m "test(web): cover hashed filter operators"
```

---

## Task 2: Preserve hashed-filter operators in `rewrite.ts`

**Files:**
- Modify: `apps/web/src/server/core/field-encryption/rewrite.ts`
- Modify: `apps/web/src/server/core/field-encryption/rewrite.test.ts:58-68`

**Interfaces:**
- Consumes: `hashValue`, `getHashFieldName`, `getModelSpec`, `FieldSpec`, `traverseTree`.
- Produces: `collectTargets` returns `Target[]` with `fieldPath`, `operator`, and `value`; `rewriteTarget` writes `fieldHash` or `fieldHash.<operator>` and throws on unsupported operations. Public exports (`encryptOnWrite`, `decryptOnRead`) do not change.

### Step 1: Replace the constants and target type

Replace `rewrite.ts:6-22` with:

```ts
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
```

Keep `HashConfig` below it unchanged.

### Step 2: Replace `collectTargets`

Replace the whole `collectTargets` function (`rewrite.ts:127-182`) with:

```ts
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
        operator: operator as "in" | "notIn",
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
```

### Step 3: Replace `rewriteTarget` and the path helpers

Replace `rewriteTarget` (`rewrite.ts:184-212`) and the helpers below it up to `last` (`rewrite.ts:218-245`) with:

```ts
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

function writeHashTarget(
  draft: Record<string, unknown>,
  hashPath: string[],
  target: Target,
): void {
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

function isHashClausePath(fieldPath: string[]): boolean {
  return HASH_CLAUSES.some((clause) => fieldPath.includes(clause));
}

// Mirrors the library's `isOrderBy`.
function isOrderByPath(fieldPath: string[], value: string): boolean {
  return fieldPath.includes("orderBy") && SORT_DIRECTIONS.has(value.toLowerCase());
}

// The hash column is a sibling of the encrypted column, not a child of it.
function siblingPath(fieldPath: string[], name: string): string[] {
  return [...fieldPath.slice(0, -1), name];
}

function hashFor(value: string, fieldSpec: FieldSpec): string {
  return hashValue(value, fieldSpec.hash?.normalize ?? []);
}
```

Delete `fieldPathOf`, `isSubField`, and `last`; nothing else uses them. Keep `readPath`, `writePath`, `deletePath`, `safeDecrypt`, `nextModel` unchanged.

### Step 4: Update the existing `equals` expectation

The explicit `equals` wrapper is now preserved as `emailHash.equals` (this is what lets `equals` and `not` coexist). Replace the test at `rewrite.test.ts:58-68` with:

```ts
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
```

The bare `where.email` test stays scalar, because a direct field comparison has no operator to preserve.

### Step 5: Run the tests

```bash
bun --filter @doxynix/web test src/server/core/field-encryption/rewrite.test.ts
```

Expected: all tests pass, including the new `not`/`in`/`notIn`/throw cases.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/server/core/field-encryption/rewrite.ts apps/web/src/server/core/field-encryption/rewrite.test.ts
git commit -m "fix(web): preserve hashed filter operators"
```

---

## Task 3: Align query-side hashes with stored hashes

**Files:**
- Modify: `apps/web/src/server/utils/hash.ts`
- Modify: `apps/web/src/server/utils/hash.test.ts:151-159`
- Modify: `apps/web/src/server/core/field-encryption/config.test.ts:45-52`
- Modify: `apps/web/src/server/core/field-encryption/field-encryption.integration.test.ts`

**Interfaces:**
- Consumes: `hashValue(value, normalize)` from `field-encryption/config`.
- Produces: `getRawHash(value) === hashValue(value, [])`, `getNormalizedHash(value) === hashValue(value, ["lowercase", "trim"])`. No NFC pass.

No data migration is needed: the audit of `emailHash`/`identifierHash` writes found no direct writer that survives the extension. `auth-adapter.ts` sets `emailHash` before calling Prisma, but `encryptOnWrite` overwrites it from the plaintext email in the same `create`/`update`. Every stored hash therefore came from `hashValue` (or the old library's identical no-NFC hash).

### Step 1: Add the failing end-to-end hash test

In `field-encryption.integration.test.ts`, add the import:

```ts
import { getNormalizedHash } from "@/server/utils/hash";
```

Add this test inside `describe("field-encryption end to end", ...)`:

```ts
it("writes the hash getNormalizedHash will query for NFD input", () => {
  const email = `${String.fromCodePoint(0x63, 0x61, 0x66, 0x65, 0x3_01)}@example.com`;
  const written = encryptOnWrite({ data: { email } }, "User", key);
  const data = written.data as Record<string, unknown>;

  expect(data.emailHash).toBe(getNormalizedHash(email));
});
```

Run:

```bash
bun --filter @doxynix/web test src/server/core/field-encryption/field-encryption.integration.test.ts
```

Expected: FAIL — the extension hashes NFD bytes, `getNormalizedHash` NFC-normalizes them.

### Step 2: Delegate both hash helpers to `hashValue`

In `hash.ts`, replace the env import:

```ts
import { API_KEY_CHECKSUM_SECRET, API_KEY_PEPPER } from "@/shared/config/env.server";
```

Add:

```ts
import { hashValue } from "@/server/core/field-encryption/config";
```

Replace `getRawHash` and `getNormalizedHash` with:

```ts
export function getRawHash(value: string): string {
  return hashValue(value, []);
}

// PRISMA ONLY: the field-encryption extension hashes lowercase + trim, without NFC.
// Matching that byte-for-byte keeps stored and queried emailHash/identifierHash in sync.
export function getNormalizedHash(value: string): string {
  return hashValue(value, ["lowercase", "trim"]);
}
```

Delete the now-unused `PRISMA_FIELD_ENCRYPTION_HASH_SALT` import from `hash.ts`.

### Step 3: Update the NFC tests

In `hash.test.ts`, add `hashValue` to the imports:

```ts
import { hashValue } from "@/server/core/field-encryption/config";
```

Rename the earlier test at `hash.test.ts:137` from `"should normalize, trim, lower-case, and NFC-normalize strings before hashing"` to `"should trim and lower-case strings before hashing"`; its assertions stay the same.

Replace the test at `hash.test.ts:151-159` with:

```ts
it("does not NFC-normalize, matching the stored field-encryption hash", () => {
  const nfcString = "\u00E9";
  const nfdString = "e\u0301";

  expect(getNormalizedHash(nfdString)).toBe(hashValue(nfdString, ["lowercase", "trim"]));
  expect(getNormalizedHash(nfcString)).toBe(hashValue(nfcString, ["lowercase", "trim"]));
  expect(getNormalizedHash(nfcString)).not.toBe(getNormalizedHash(nfdString));
});
```

In `config.test.ts`, replace the test at `config.test.ts:45-52` with:

```ts
it("matches getNormalizedHash for NFD input instead of silently NFC-normalizing", () => {
  const nfc = String.fromCodePoint(0x63, 0x61, 0x66, 0xe9);
  const nfd = String.fromCodePoint(0x63, 0x61, 0x66, 0x65, 0x3_01);

  expect(hashValue(nfc, ["lowercase", "trim"])).not.toBe(
    hashValue(nfd, ["lowercase", "trim"]),
  );
  expect(hashValue(nfd, ["lowercase", "trim"])).toBe(getRawHash(nfd));
  expect(getNormalizedHash(nfd)).toBe(hashValue(nfd, ["lowercase", "trim"]));
});
```

### Step 4: Run the hash and encryption tests

```bash
bun --filter @doxynix/web test src/server/utils/hash.test.ts src/server/core/field-encryption/config.test.ts src/server/core/field-encryption/field-encryption.integration.test.ts
```

Expected: all pass, including the NFD write/query test.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/utils/hash.ts apps/web/src/server/utils/hash.test.ts apps/web/src/server/core/field-encryption/config.test.ts apps/web/src/server/core/field-encryption/field-encryption.integration.test.ts
git commit -m "fix(web): align Prisma field hashes with stored values"
```

---

## Task 4: Search banned emails after decryption

**Files:**
- Modify: `apps/web/src/server/utils/search.ts`
- Modify: `apps/web/src/server/utils/search.test.ts`
- Modify: `apps/web/src/server/modules/banned-emails/banned-email.service.ts`
- Modify: `apps/web/src/server/modules/banned-emails/banned-email.service.test.ts`
- Modify: `apps/web/src/tests/integration/banned-email.test.ts`

**Interfaces:**
- Consumes: `normalizeSearchInput`, `clampPage`, `getPaginationMeta`, `BANNED_EMAIL_SELECT`.
- Produces: `matchesSearchTerm(value: string, normalizedTerm: string): boolean`; `bannedEmailService.getAll` never emits `contains` on an encrypted field.

### Step 1: Add the matcher and its test

In `search.ts`, append:

```ts
export function matchesSearchTerm(value: string, normalizedTerm: string): boolean {
  return value.normalize("NFC").toLowerCase().includes(normalizedTerm);
}
```

In `search.test.ts`, add `matchesSearchTerm` to the import and add:

```ts
it("matches normalized terms against NFC and NFD values", () => {
  const nfc = "Caf\u00E9@Example.com";
  const nfd = "cafe\u0301@example.com";
  const term = normalizeSearchInput("cafe\u0301");

  expect(term).toBeDefined();
  expect(matchesSearchTerm(nfc, term as string)).toBe(true);
  expect(matchesSearchTerm(nfd, term as string)).toBe(true);
});
```

Run:

```bash
bun --filter @doxynix/web test src/server/utils/search.test.ts
```

Expected: PASS.

### Step 2: Replace the ciphertext `contains` clause

Search scans at most `MAX_PAGE * limit` (10,000) decrypted rows — the same cap the list endpoint already uses. If the ban list can exceed that, a dedicated search index is a separate project; do not silently return partial results without the cap being documented in the service comment.

In `banned-email.service.ts`, update the pagination import:

```ts
import {
  buildDateRangeWhere,
  cappedCount,
  clampPage,
  getPaginatedList,
  getPaginationMeta,
  ORDER_CREATED_AT_DESC,
} from "@/server/utils/pagination";
```

Update the search import:

```ts
import { matchesSearchTerm, normalizeSearchInput } from "@/server/utils/search";
```

Delete `buildSearchClause` and make `buildWhereClause` return only non-encrypted filters:

```ts
buildWhereClause(filters: Partial<BannedEmailFilterInput>) {
  return {
    ...(filters.reason != null ? { reason: filters.reason } : {}),
    ...buildDateRangeWhere(filters, "createdAt"),
  };
},
```

Replace `getAll` with:

```ts
async getAll(db: DbClient, input: BannedEmailFilterInput) {
  const { limit } = input;
  const where = this.buildWhereClause(input);
  const isUnfiltered = Object.keys(where).length === 0;
  const term = normalizeSearchInput(input.search);
  const cap = MAX_PAGE * limit;

  const countMatching = (filterWhere: Prisma.BannedEmailWhereInput) =>
    cappedCount(
      (take) => db.bannedEmail.findMany({ select: { id: true }, take, where: filterWhere }),
      cap,
    );

  if (term != null) {
    const [rows, totalCount] = await Promise.all([
      db.bannedEmail.findMany({
        orderBy: ORDER_CREATED_AT_DESC,
        select: BANNED_EMAIL_SELECT,
        take: cap,
        where,
      }),
      countMatching({}),
    ]);
    const filtered = rows.filter((row) => matchesSearchTerm(row.email, term));
    const page = clampPage(input.page);
    const skip = (page - 1) * limit;

    return {
      items: filtered.slice(skip, skip + limit).map(toSummary),
      meta: getPaginationMeta({
        capped: filtered.length >= cap,
        filteredCount: filtered.length,
        limit,
        page,
        search: input.search,
        totalCount,
      }),
    };
  }

  const { items, meta } = await getPaginatedList({
    countCap: cap,
    countFiltered: () => countMatching(where),
    countUnfiltered: isUnfiltered ? null : () => countMatching({}),
    fetchItems: ({ skip, take }) =>
      db.bannedEmail.findMany({
        orderBy: ORDER_CREATED_AT_DESC,
        select: BANNED_EMAIL_SELECT,
        skip,
        take,
        where,
      }),
    input: { ...input, limit },
  });

  return { items: items.map(toSummary), meta };
},
```

### Step 3: Replace the broken where-clause unit test

In `banned-email.service.test.ts`, delete the test named `"searches the email case-insensitively and ignores a blank term"` (it asserted the ciphertext `contains` shape) and add:

```ts
it("filters a search term after decrypting the rows", async () => {
  const rows = [
    {
      createdAt: new Date("2026-01-01"),
      email: "spam@example.com",
      id: "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d",
      reason: "MANUAL" as const,
    },
    {
      createdAt: new Date("2026-01-02"),
      email: "ham@example.com",
      id: "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e",
      reason: "MANUAL" as const,
    },
  ];
  const findMany = vi.fn().mockResolvedValue(rows);
  const db = { bannedEmail: { findMany } };

  const result = await bannedEmailService.getAll(db as never, { limit: 10, search: "spam" });

  expect(result.items.map((item) => item.email)).toEqual(["spam@example.com"]);
  expect(result.meta.filteredCount).toBe(1);
  expect(result.meta.totalCount).toBe(2);
});
```

### Step 4: Add the real-DB search test

In `src/tests/integration/banned-email.test.ts`, add:

```ts
it("searches the decrypted email instead of the ciphertext column", async () => {
  await cleanupDatabase();

  const admin = await createTestUser("Admin", "ADMIN");

  await bannedEmailService.create(admin.db, { email: "spam@example.com" });
  await bannedEmailService.create(admin.db, { email: "ham@example.com" });

  const result = await bannedEmailService.getAll(admin.db, { limit: 10, search: "spam" });

  expect(result.items.map((item) => item.email)).toEqual(["spam@example.com"]);
  expect(result.meta.filteredCount).toBe(1);
  expect(result.meta.totalCount).toBe(2);
});
```

### Step 5: Run unit tests

```bash
bun --filter @doxynix/web test src/server/utils/search.test.ts src/server/modules/banned-emails/banned-email.service.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/server/utils/search.ts apps/web/src/server/utils/search.test.ts apps/web/src/server/modules/banned-emails/banned-email.service.ts apps/web/src/server/modules/banned-emails/banned-email.service.test.ts apps/web/src/tests/integration/banned-email.test.ts
git commit -m "fix(web): search banned emails after decryption"
```

---

## Task 5: Fix integration-test cleanup for encrypted emails

**Files:**
- Modify: `apps/web/src/tests/helpers.ts:63-70`
- Modify: `apps/web/src/tests/integration/banned-email.test.ts`

**Interfaces:**
- Consumes: the existing `TRUNCATE ... CASCADE` statement.
- Produces: `cleanupDatabase()` removes users without filtering on encrypted `email`.

### Step 1: Replace the ciphertext cleanup

`assertDisposableDatabase()` already refuses to run against a database whose name does not contain `test`, so truncating `users` cannot hit a real database.

Add `"users"` to the `tablenames` array:

```ts
    "webhook_deliveries",
    "users",
  ];
```

Remove this block:

```ts
  await prisma.user.deleteMany({
    where: {
      OR: [{ email: { contains: "@test.com" } }, { email: { contains: "@git.hub" } }],
    },
  });
```

Update the comment above the truncate:

```ts
  // One statement instead of one round trip per table. `users` is included because
  // `email` is ciphertext here, so the old `contains` cleanup could never match.
```

### Step 2: Verify no integration test uses a plaintext email filter

```bash
rg -n "email:\s*\{[^}]*contains" apps/web/src/tests
```

Expected: no matches.

### Step 3: Add the cleanup regression test

Append this test to `src/tests/integration/banned-email.test.ts`:

```ts
it("cleanupDatabase removes users whose email is encrypted", async () => {
  await cleanupDatabase();
  await createTestUser("Cleanup", "USER");
  await cleanupDatabase();

  await expect(prisma.user.count()).resolves.toBe(0);
});
```

### Step 4: Run the banned-email integration test

```bash
bun --filter @doxynix/web test:int
```

Expected: PASS. This also exercises the new decrypted-search path and the new `TRUNCATE users`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tests/helpers.ts apps/web/src/tests/integration/banned-email.test.ts
git commit -m "test(web): truncate users instead of matching encrypted email"
```

---

## Task 6: Full verification

**Files:**
- No code changes.

- [ ] **Step 1: Run the focused unit suite**

```bash
bun --filter @doxynix/web test src/server/core/field-encryption src/server/utils/hash.test.ts src/server/utils/search.test.ts src/server/modules/banned-emails
```

Expected: all pass.

- [ ] **Step 2: Run the integration suite**

```bash
bun --filter @doxynix/web test:int
```

Expected: all pass against the disposable test database. If the database is not configured, follow `CONTRIBUTING.md`: create `dxnx_web_test`, point the `tst` Doppler config at it, then `bun --filter @doxynix/web db:push:test`.

- [ ] **Step 3: Format and run the repository gate**

```bash
bun run format
bun run validate
```

Expected: `format` rewrites only the touched files; `validate` passes. `validate` includes Biome, Oxlint, FSD/i18n checks, `arch:check`, index parity, and type-check.

- [ ] **Step 4: Check the final diff for out-of-scope changes**

```bash
git diff --stat HEAD~5..HEAD
git diff HEAD~5..HEAD -- apps/web/src/server/core/field-encryption apps/web/src/server/utils/hash.ts apps/web/src/server/utils/search.ts apps/web/src/server/modules/banned-emails apps/web/src/tests
```

Expected: only the files listed in this plan. No changes to `config.generated.ts`, `schema.prisma`, cipher format, key fingerprint, `toReversed`, or `getSensitiveFieldNames`.

---

## Follow-ups not in this plan

These are real but separate; do not mix them into this change:

1. **Email normalization at write boundaries.** The extension hashes the value it receives. `User.create.before` normalizes plus-tags/Gmail aliases, but `User.update` and OAuth `Account` creation may not. Audit write paths for `User.email`, `Account.email`, and `BannedEmail.email` and enforce `normalizeEmail` before the extension sees them.
2. **`orderBy` on encrypted fields** is silently dropped (`rewrite.test.ts:78-83`). Decide whether to throw or sort by hash; not a security issue.
3. **`distinct`/`groupBy` on encrypted fields** are not rewritten and operate on ciphertext. No current usage; add a guard if a feature needs them.
4. **`toReversed()` micro-optimization** — only with a profile showing GC pressure; use a reverse `for` loop over `Object.entries` if needed.
5. **Cipher auth-tag length** — already planned in `2026-11-01-semgrep-adoption.md` Task 5; do not duplicate.
