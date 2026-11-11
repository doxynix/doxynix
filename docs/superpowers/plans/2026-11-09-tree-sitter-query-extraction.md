# Tree-sitter Query Extraction & AST Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace regex-driven AST signal extraction with Tree-sitter Query API extraction, fix the current correctness bugs, and add symbol-index and call-graph intelligence on top of the parsed structure.

**Architecture:** Keep `web-tree-sitter@0.20.8` and `tree-sitter-wasms@0.1.13` as the runtime for Milestones 0–4. Add a query cache and per-language query specs under `analysis/engine/extractors/queries/`. Normalize query captures into the existing `FileSignals` model. Keep regex only as (a) fallback for unsupported languages and (b) genuinely text-level work (secrets, TODOs, diff hunks, manifests). Build a symbol index and call graph from normalized imports/exports. Later milestones add AST-aware PR mapping, AST security sink queries, per-function complexity, and optional runtime/grammar upgrades.

**Tech Stack:** TypeScript strict, Bun 1.4, Vitest, `web-tree-sitter@0.20.8`, `tree-sitter-wasms@0.1.13`, Trigger.dev v4, Zod 4, Graphology.

**Spec:** §1 Context & Audit Findings (self-contained repository audit, 2026-11-09). Related architecture rules: `.agents/skills/analysis-engine/SKILL.md`, `.agents/skills/architecture/SKILL.md`.

## Global Constraints

- Bun only. Never run `npm`, `yarn`, or `pnpm`.
- Do not upgrade `web-tree-sitter` or `tree-sitter-wasms` in Milestones 0–4. They are frozen by `renovate.json` and patched by `patches/tree-sitter-wasms@0.1.13.patch`. Upgrade only in Milestone 5.
- Do not use `node-tree-sitter` native bindings. The runtime is Trigger.dev `bun-1.4` and portability matters more than the last 20% of parse speed.
- Do not delete `@secretlint/core` or `secretlint`. Secret detection stays regex/rule-based.
- Do not move analysis code into `apps/web/src/server/core`. `core` sits below slices and must not import from `modules/analysis`.
- All new files are kebab-case (Oxlint `unicorn/filename-case`).
- 100-column line width. Biome formats on write and reorders imports; always re-read the file after `bun run format`.
- No `console.log`; use `appLogger` or `taskLogger`.
- No non-null assertions (`typescript/no-non-null-assertion`). Use explicit `null` checks. The test snippets below use `spec!` for brevity; in real code, guard with `if (spec == null) { throw new Error("missing grammar spec"); }` and pass the narrowed value.
- No floating promises (`typescript/no-floating-promises`). Await or `void` explicitly.
- Every `tree-sitter` `Tree`, `TreeCursor`, and `Query` that is created must be deleted in a `finally` block, except process-lifetime cached queries which are deleted by `disposeQueries()`.
- Keep analysis results backward-compatible: new fields on `FileSignals`/`SymbolRef` are optional. Do not change persisted `RepoMetrics` field names.
- Branch: `feat/dxnx-0-tree-sitter-queries` (replace `0` with the Linear ticket number if one is assigned). The Lefthook hook only requires a `dxnx` prefix.
- Commit subjects: Conventional Commits, ≤72 chars, no trailing period, no ticket in the subject. Use scope `web`:
  - `fix(web): ...`
  - `feat(web): ...`
  - `refactor(web): ...`
  - `test(web): ...`
  - `docs(web): ...`
- Never use `--no-verify`. If a hook rejects, fix the code or the branch name.
- Run tests with `bun --filter @doxynix/web test <path>` from the repository root. If Doppler is not authenticated, prefix the command with `CI=true` (see `scripts/doppler.ts`).
- Run `bun run format` after every code change and `bun run lint` before every commit.
- `apps/web` type-check is memory-heavy; use `bun run type-check` from the root only at milestone boundaries, not after every step.

---

## 1. Context & Audit Findings

This section is the spec. Executors should read it before Task 0.1.

### 1.1 Current runtime

- `apps/web/src/server/core/tree-sitter/index.ts` loads `web-tree-sitter` through `createRequire`, initializes the WASM runtime, caches `Language` objects by extension, and exposes `createParser()`.
- `SPECS` maps 24 extensions to grammars. `TREE_SITTER_SUPPORTED_EXTENSIONS` is the key list.
- No query cache exists.

### 1.2 Current extraction

- `apps/web/src/server/modules/analysis/engine/extractors/tree-sitter-signals.ts` walks the tree with `root.walk()`.
- It computes `const nodeText = cursor.nodeText` for **every** visited node.
- Declarations are counted by node type. Every declaration gets `exported: true`.
- Symbol names are extracted with `/([A-Z_a-z]\w*)/` on the first line of the declaration text. This yields `function`, `class`, `interface`, `type`, `enum`, `def`, `func` instead of the real names.
- Imports are gated by node type, then extracted with regex on `nodeText`.
- Routes are extracted with `file.content.matchAll(...)` — pure regex, even in “tree-sitter mode”.
- `lineOf(content, fragment)` uses `content.indexOf(fragment)`, so duplicate fragments produce wrong lines and the cost is O(files × symbols × file length).
- `parser.delete()` is called, but `cursor.delete()` is not.
- `rootNode.hasError()` is never checked.
- `typescript-signals.ts` wraps tree-sitter signals and adds regex counts for tRPC procedures/HTTP verbs, a regex entrypoint check, and regex framework tokens.
- `regex-signals.ts` is the fallback for unsupported languages; its `complexityMetrics` are always `{ complexity: 0, maxNesting: 0 }`.
- `optimizers.ts` uses tree-sitter to hide function bodies. This use is correct and stays.

### 1.3 Verified defects

| # | Defect | Evidence |
|---|---|---|
| 1 | Symbol names are keywords | `function_declaration` → `function`; `class_declaration` → `class`; Python `def greet` → `def`. `childForFieldName("name")` returns the real name. |
| 2 | `exports` counts every declaration | `analysis.mapper.ts`: 18 methods + 26 arrow functions + 4 type aliases = 48 “exports”, but only 2 `export_statement` nodes. |
| 3 | All symbols are `exported: true` | `tree-sitter-signals.ts` hard-codes it. `publicSurface` and `publicExports` are inflated. |
| 4 | TS routes are counted three times | `TS_ROUTE_PATTERNS` has three identical regexes labelled Hono/Express/Fastify. One `app.get` produces three `RouteRef`s. Go Gin/Echo are duplicated too. |
| 5 | Route regexes match comments and strings | `collectRoutes` runs on raw `file.content`. |
| 6 | Wrong line numbers | `lineOf` uses `indexOf` of the first occurrence. |
| 7 | No parse-error detection | `rootNode.hasError()` is never called. Modern TS `accessor` produces an `ERROR` node but the result keeps `confidence: 80`. |
| 8 | Broken grammar entries | `.cs` filename mismatch; `.erl`/`.jl` wasm absent; `.rb` parse throws. All silently fall back to regex. |
| 9 | Wasted allocations | `cursor.nodeText` for every node; measured 4.0 MB of strings for a 307 KB file. |
| 10 | No query API usage | `Language.query`, `Query.matches`, `Query.captures` are not used anywhere in `apps/web/src`. |
| 11 | Dead `typescript-ast` tier | `ParseTier` includes it, `ADAPTER_PRIORITIES.typescript = 300`, `CONFIDENCE_LEVELS.tsCompiler = 95`, but no code emits `analysisMode: "typescript-ast"`. `typeScriptAstFiles` is always 0. |
| 12 | No call graph | README claims “call hierarchies”/“call trees”; no call extraction exists. |
| 13 | Docs drift | Sentinel is a prompt-injection LLM check, not an AST security pass. PR Sentinel is line regex. Metrics docs claim per-function complexity but code computes a file-level score. UI graph nodes are `file`/`group`, not `symbol`. |

### 1.4 What Tree-sitter already supports in 0.20.8

- `Language.query(source): Query`
- `Query.matches(node)`, `Query.captures(node)`, `Query.delete()`
- `#eq?`, `#not-eq?`, `#match?`, `#not-match?` predicates are evaluated by the JS binding
- `SyntaxNode.childForFieldName(name)`, `descendantsOfType(types)`, `startPosition.row`
- `SyntaxNode.hasError()`, `isMissing()`, `(ERROR)`/`(MISSING)` queries
- `Parser.setTimeoutMicros(value)`
- `Tree.edit()`, `Parser.parse(text, oldTree)`, `Tree.getChangedRanges()`
- `Parser.parse(text, undefined, { includedRanges })`
- `TreeCursor.delete()`

### 1.5 Non-goals

- Do not build symbol-level graph nodes in the XYFlow UI in this plan. The UI stays `file`/`group`; symbol data is used by prompts, metrics, impact analysis, and docs.
- Do not replace `secretlint`.
- Do not introduce `node-tree-sitter`, `ts-morph`, `oxc-parser`, `CodeQL`, `Semgrep`, `SCIP`, or LSP in this plan. They are separate decisions.
- Do not change the database schema.
- Do not hand-edit `apps/web/prisma/schema.prisma` or any generated file.
- Do not touch `apps/siem-server` or `packages/cli`.

---

## 2. File Structure

### 2.1 New files

| Path | Responsibility |
|---|---|
| `apps/web/src/server/core/tree-sitter/query-cache.ts` | Compile and cache `Query` objects per extension + query source; dispose for tests |
| `apps/web/src/server/core/tree-sitter/query-cache.test.ts` | Query cache contract |
| `apps/web/src/server/modules/analysis/engine/extractors/queries/types.ts` | `LanguageQuerySpec` contract |
| `apps/web/src/server/modules/analysis/engine/extractors/queries/captures.ts` | Capture grouping helpers |
| `apps/web/src/server/modules/analysis/engine/extractors/queries/captures.test.ts` | Capture helper tests |
| `apps/web/src/server/modules/analysis/engine/extractors/queries/typescript.ts` | TS/TSX query spec |
| `apps/web/src/server/modules/analysis/engine/extractors/queries/javascript.ts` | JS/JSX/MJS/CJS query spec |
| `apps/web/src/server/modules/analysis/engine/extractors/queries/python.ts` | Python query spec |
| `apps/web/src/server/modules/analysis/engine/extractors/queries/go.ts` | Go query spec |
| `apps/web/src/server/modules/analysis/engine/extractors/queries/rust.ts` | Rust query spec |
| `apps/web/src/server/modules/analysis/engine/extractors/queries/java.ts` | Java query spec |
| `apps/web/src/server/modules/analysis/engine/extractors/queries/csharp.ts` | C# query spec |
| `apps/web/src/server/modules/analysis/engine/extractors/queries/php.ts` | PHP query spec |
| `apps/web/src/server/modules/analysis/engine/extractors/queries/c.ts` | C query spec |
| `apps/web/src/server/modules/analysis/engine/extractors/queries/cpp.ts` | C++ query spec |
| `apps/web/src/server/modules/analysis/engine/extractors/queries/index.ts` | `QUERY_SPECS` registry by extension |
| `apps/web/src/server/modules/analysis/engine/extractors/query-signals.ts` | Run queries, normalize captures, build `FileSignals` |
| `apps/web/src/server/modules/analysis/engine/extractors/query-signals.test.ts` | Query extractor integration tests |
| `apps/web/src/server/modules/analysis/engine/core/symbol-index.ts` | Build per-file symbol/export maps |
| `apps/web/src/server/modules/analysis/engine/core/symbol-index.test.ts` | Symbol index tests |
| `apps/web/src/server/modules/analysis/engine/core/call-graph.ts` | Intra-file and cross-file call edges |
| `apps/web/src/server/modules/analysis/engine/core/call-graph.test.ts` | Call graph tests |
| `apps/web/src/server/modules/analysis/logic/diff-node-mapper.ts` | Map changed lines to AST nodes |
| `apps/web/src/server/modules/analysis/logic/diff-node-mapper.test.ts` | Diff mapping tests |
| `apps/web/src/server/modules/analysis/engine/extractors/security-query-specs.ts` | Per-language security sink queries |
| `apps/web/src/server/modules/analysis/engine/extractors/security-signals.ts` | AST sink extraction |
| `apps/web/src/server/modules/analysis/engine/extractors/security-signals.test.ts` | AST security tests |

### 2.2 Modified files

| Path | Change |
|---|---|
| `core/tree-sitter/index.ts` | Add `getParserForExt`, `disposeTreeSitter`, `getWasmPath`; fix `.cs`; remove `.erl`/`.jl`/`.rb` until Milestone 5 |
| `analysis/engine/extractors/tree-sitter-signals.ts` | Dispatch to query path; keep `collectLegacySignals` temporarily |
| `analysis/engine/extractors/typescript-signals.ts` | Keep regex extras, stop double-counting `apiSurface` |
| `analysis/engine/extractors/regex-signal-specs.ts` | Keep as fallback; no new languages here |
| `analysis/engine/core/discovery.types.ts` | Add `ImportRef`, optional symbol/import/call fields |
| `analysis/engine/core/evidence.ts` | Build symbol index and call edges; expose `calls` |
| `analysis/engine/core/evidence-support.ts` | Prefer `importDetails`; dedupe route inventory |
| `analysis/engine/core/scoring-constants.ts` | Add `astPartial` confidence |
| `analysis/engine/metrics/code-metrics.ts` | Use AST security findings; per-function complexity when available |
| `analysis/engine/metrics/code-metric-scan.ts` | Keep `typeScriptAstFiles` at 0 until Milestone 6; no fake coverage |
| `analysis/logic/differential-analyzer.ts` | Use AST diff mapping and AST security when file contents are available |
| `analysis/tasks/analyze-pr.task.ts` | Fetch head file contents for changed files (size-capped) |
| `analysis/logic/mapper-skeleton.ts` | Include real symbol counts only; do not dump symbol names into the payload |
| `apps/web/src/server/utils/optimizers.ts` | Use `getParserForExt` and delete cursors if it ever adds one |
| `apps/web/README.md` | Align claims with reality |
| `apps/web/content/docs/concepts/architecture.mdx` | Align AST claims |
| `apps/web/content/docs/concepts/documents.mdx` | Align symbols/routes source |
| `apps/web/content/docs/concepts/metrics.mdx` | Describe per-function complexity after Milestone 4 |
| `.agents/skills/analysis-engine/SKILL.md` | Correct the Sentinel description |

---

## 3. Milestones

| Milestone | Outcome | Tasks |
|---|---|---|
| 0 | Current AST output is truthful: real names, real exports, deduped routes, correct grammars, parse-error detection, clean lifecycle | 0.1–0.6 |
| 1 | Query runtime + TS/JS/TSX extraction | 1.1–1.7 |
| 2 | Polyglot query specs for the remaining supported languages | 2.1–2.10 |
| 3 | Symbol index and call graph | 3.1–3.5 (3.6 deferred) |
| 4 | AST-aware PR review, security sinks, per-function complexity | 4.1–4.5 |
| 5 | Optional runtime/grammar upgrade | 5.1–5.3 |

Milestones 3–5 can be split into separate PRs after Milestone 2. Do not merge a later milestone before its predecessor’s tests pass.

---

## Milestone 0 — Make the current AST output truthful

### Task 0.1: Extract real symbol names and line numbers

**Files:**
- Modify: `apps/web/src/server/modules/analysis/engine/extractors/tree-sitter-signals.ts`
- Test: `apps/web/src/server/modules/analysis/engine/extractors/tree-sitter-signals.test.ts`

**Interfaces:**
- Consumes: `collectTreeSitterSignals(file: RepositoryFile): Promise<FileSignals | null>`
- Produces: same signature; `symbols[].name` is the identifier from the grammar’s `name` field; `symbols[].line` is `node.startPosition.row + 1`.

- [ ] **Step 1: Write the failing test**

Append this test to `tree-sitter-signals.test.ts`:

```ts
it("extracts real symbol names and 1-based lines for TypeScript declarations", async () => {
  const result = await collectTreeSitterSignals({
    content: [
      "export function greet(name: string) { return name; }",
      "class UserService { run() {} }",
      "interface UserRepo { find(): void }",
      "type Id = string;",
      "enum Role { Admin }",
    ].join("\n"),
    path: "src/sample.ts",
  });

  expect(result?.symbols.map((symbol) => symbol.name)).toEqual([
    "greet",
    "UserService",
    "run",
    "UserRepo",
    "Id",
    "Role",
  ]);
  expect(result?.symbols.map((symbol) => symbol.line)).toEqual([1, 2, 2, 3, 4, 5]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/tree-sitter-signals.test.ts
```

Expected: FAIL. The actual names are `["function", "class", "run", "interface", "type", "enum"]`.

- [ ] **Step 3: Write the minimal implementation**

In `tree-sitter-signals.ts`, replace `extractNodeName` usage inside the traversal with the grammar field. Keep `extractNodeName` only as a fallback for grammars that do not expose a `name` field.

```ts
function nodeName(node: Parser.SyntaxNode): string | undefined {
  return node.childForFieldName("name")?.text ?? extractNodeName(node.text);
}
```

Change the declaration branch to use the current node, not the precomputed text:

```ts
if (declarationTypes.has(nodeType)) {
  exports += 1;
  const node = cursor.currentNode();
  const name = nodeName(node);
  if (name != null) {
    const kind = declarationKindByType.get(nodeType) ?? "function";
    symbols.push({
      confidence: CONFIDENCE_LEVELS.astSymbol,
      exported: true,
      kind,
      line: node.startPosition.row + 1,
      name,
      path: file.path,
    });
  }
}
```

Do not compute `cursor.nodeText` at the top of the loop. Compute `const nodeText = cursor.nodeText` only inside the import branch and the `spec.api` branch:

```ts
if (spec.imports.types.includes(nodeType)) {
  const nodeText = cursor.nodeText;
  spec.imports.patterns.forEach((re) => {
    const match = nodeText.match(re);
    if (match?.[1]) {
      imports.add(match[1]);
    }
  });
}

if (spec.api?.some((re) => re.test(cursor.nodeText))) {
  apiSurface++;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/tree-sitter-signals.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/modules/analysis/engine/extractors/tree-sitter-signals.ts \
  apps/web/src/server/modules/analysis/engine/extractors/tree-sitter-signals.test.ts
git commit -m "fix(web): extract real tree-sitter symbol names"
```

---

### Task 0.2: Correct export detection and export counts

**Files:**
- Modify: `apps/web/src/server/modules/analysis/engine/extractors/tree-sitter-signals.ts`
- Test: `apps/web/src/server/modules/analysis/engine/extractors/tree-sitter-signals.test.ts`

**Interfaces:**
- Consumes: `collectTreeSitterSignals(file)`
- Produces: `symbols[].exported` is true only for declarations reachable from an `export_statement` or listed in an export clause; `exports` equals the number of unique exported symbol names.

- [ ] **Step 1: Write the failing test**

Append:

```ts
it("marks only exported declarations and counts unique exported names", async () => {
  const result = await collectTreeSitterSignals({
    content: [
      "export function a() {}",
      "function b() {}",
      "const c = () => 1;",
      "export { b as publicB };",
      "export default class D {}",
    ].join("\n"),
    path: "src/exports.ts",
  });

  const byName = new Map((result?.symbols ?? []).map((symbol) => [symbol.name, symbol]));
  expect(byName.get("a")?.exported).toBe(true);
  expect(byName.get("b")?.exported).toBe(true);
  expect(byName.get("c")?.exported).toBe(false);
  expect(byName.get("D")?.exported).toBe(true);
  expect(result?.exports).toBe(3);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/tree-sitter-signals.test.ts
```

Expected: FAIL. `b` is `false` and `exports` is `5`.

- [ ] **Step 3: Write the minimal implementation**

Add `collectExportedNames` above `collectTreeSitterSignals`:

```ts
function collectExportedNames(root: Parser.SyntaxNode): Set<string> {
  const names = new Set<string>();

  for (const statement of root.descendantsOfType("export_statement")) {
    const declaration = statement.childForFieldName("declaration");
    const declarationName = declaration?.childForFieldName("name")?.text;
    if (declarationName != null) {
      names.add(declarationName);
    }

    for (const specifier of statement.descendantsOfType("export_specifier")) {
      const specifierName = specifier.childForFieldName("name")?.text;
      if (specifierName != null) {
        names.add(specifierName);
      }
    }
  }

  return names;
}
```

Inside `collectTreeSitterSignals`, after `const root = tree.rootNode;`:

```ts
const exportedNames = collectExportedNames(root);
```

Remove `exports += 1` from the declaration branch. Use:

```ts
const exported = exportedNames.has(name) || node.parent?.type === "export_statement";
symbols.push({
  confidence: CONFIDENCE_LEVELS.astSymbol,
  exported,
  kind,
  line: node.startPosition.row + 1,
  name,
  path: file.path,
});
```

At the end of the function, before `return`:

```ts
const exportedCount = new Set(
  symbols.filter((symbol) => symbol.exported).map((symbol) => symbol.name),
).size;
```

Return `exports: exportedCount` instead of `exports`.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/tree-sitter-signals.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/modules/analysis/engine/extractors/tree-sitter-signals.ts \
  apps/web/src/server/modules/analysis/engine/extractors/tree-sitter-signals.test.ts
git commit -m "fix(web): count only exported tree-sitter symbols"
```

---

### Task 0.3: Deduplicate routes and attribute frameworks

**Files:**
- Modify: `apps/web/src/server/core/tree-sitter/index.ts`
- Modify: `apps/web/src/server/modules/analysis/engine/extractors/tree-sitter-signals.ts`
- Test: `apps/web/src/server/modules/analysis/engine/extractors/tree-sitter-signals.test.ts`

**Interfaces:**
- Consumes: `collectTreeSitterSignals(file)`
- Produces: `routes` contains one `RouteRef` per `(sourcePath, method, path)`; `framework` is derived from the import set or `undefined`.

- [ ] **Step 1: Write the failing test**

Append:

```ts
it("emits one route per method and path and attributes Hono from imports", async () => {
  const result = await collectTreeSitterSignals({
    content: [
      'import { Hono } from "hono";',
      "const app = new Hono();",
      'app.get("/users", handler);',
      'app.post("/users", handler);',
      'app.get("/users", handler);',
    ].join("\n"),
    path: "src/api.ts",
  });

  expect(result?.routes).toHaveLength(2);
  expect(result?.routes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ framework: "Hono", method: "GET", path: "/users" }),
      expect.objectContaining({ framework: "Hono", method: "POST", path: "/users" }),
    ]),
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/tree-sitter-signals.test.ts
```

Expected: FAIL with 6 routes (3 frameworks × 2 matches) or 3 routes for the duplicate GET.

- [ ] **Step 3: Write the minimal implementation**

In `core/tree-sitter/index.ts`, replace the three identical `TS_ROUTE_PATTERNS` entries with one neutral entry:

```ts
const TS_ROUTE_PATTERNS = [
  {
    framework: "js-ts-router",
    methodIndex: 1,
    pathIndex: 2,
    pattern: /\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/g,
  },
];
```

In `tree-sitter-signals.ts`, add:

```ts
function detectRouteFramework(imports: Iterable<string>): string | undefined {
  const specifiers = [...imports];
  if (specifiers.some((specifier) => specifier === "hono" || specifier.startsWith("hono/"))) {
    return "Hono";
  }
  if (specifiers.includes("express")) {
    return "Express";
  }
  if (specifiers.some((specifier) => specifier === "fastify" || specifier.startsWith("fastify/"))) {
    return "Fastify";
  }
  return undefined;
}

function dedupeRoutes(routes: RouteRef[]): RouteRef[] {
  const seen = new Set<string>();
  return routes.filter((route) => {
    const key = `${route.method ?? ""}:${route.path}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
```

Change the route block:

```ts
const framework = detectRouteFramework(imports);
const routes = dedupeRoutes(
  collectRoutes(file, spec).map((route) => ({
    ...route,
    framework: route.framework === "js-ts-router" ? framework : route.framework,
  })),
);
```

For Go, dedupe also collapses the Gin/Echo duplicates because `dedupeRoutes` keys on method + path. Keep the framework from the first matching pattern for now; Milestone 2 replaces this with query extraction.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/tree-sitter-signals.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/core/tree-sitter/index.ts \
  apps/web/src/server/modules/analysis/engine/extractors/tree-sitter-signals.ts \
  apps/web/src/server/modules/analysis/engine/extractors/tree-sitter-signals.test.ts
git commit -m "fix(web): dedupe tree-sitter routes"
```

---

### Task 0.4: Fix grammar registry and detect parse errors

**Files:**
- Modify: `apps/web/src/server/core/tree-sitter/index.ts`
- Modify: `apps/web/src/server/modules/analysis/engine/core/discovery.types.ts`
- Modify: `apps/web/src/server/modules/analysis/engine/core/scoring-constants.ts`
- Modify: `apps/web/src/server/modules/analysis/engine/extractors/tree-sitter-signals.ts`
- Test: `apps/web/src/server/modules/analysis/engine/extractors/tree-sitter-signals.test.ts`

**Interfaces:**
- Consumes: `collectTreeSitterSignals(file)`
- Produces: `FileSignals.parseError?: boolean`; `.cs` loads `tree-sitter-c_sharp.wasm`; `.erl`, `.jl`, `.rb` are no longer advertised as tree-sitter-supported; confidence is `65` when `root.hasError()`.

- [ ] **Step 1: Write the failing test**

Append:

```ts
it("uses the real C# wasm filename and does not advertise broken grammars", () => {
  expect(getSpecByExt(".cs")?.wasm).toBe("tree-sitter-c_sharp.wasm");
  expect(getSpecByExt(".erl")).toBeUndefined();
  expect(getSpecByExt(".jl")).toBeUndefined();
  expect(getSpecByExt(".kt")).toBeUndefined();
  expect(getSpecByExt(".rb")).toBeUndefined();
});

it("flags a partial parse instead of reporting full AST confidence", async () => {
  const result = await collectTreeSitterSignals({
    content: "class A { accessor x = 1; }",
    path: "src/partial.ts",
  });

  expect(result?.parseError).toBe(true);
  expect(result?.confidence).toBe(65);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/tree-sitter-signals.test.ts
```

Expected: FAIL. `.cs` still points to `tree-sitter-c-sharp.wasm`, `.erl`/`.jl` exist, and `parseError` is `undefined`.

- [ ] **Step 3: Write the minimal implementation**

In `core/tree-sitter/index.ts`:

- Change the `.cs` entry to `wasm: "tree-sitter-c_sharp.wasm"`.
- Delete the `.erl` and `.jl` entries. The bundle does not contain those wasm files; Milestone 5 re-adds them with built grammars.
- Delete the `.rb` entry. The bundled Ruby grammar throws during `parse()`; Milestone 5 replaces it with a working wasm. Regex fallback handles `.rb` until then.
- Delete the `.kt` entry. The bundled Kotlin grammar reports `hasError: true` on ordinary Kotlin files (it inserts a missing automatic semicolon). Regex fallback handles `.kt` until a newer grammar is built in Milestone 5.
- Update the existing `exports the expected list of supported extensions` test in `tree-sitter-signals.test.ts`: remove `.rb` and `.kt` from its extension list. Keep `.cs`, `.php`, `.swift`, and the rest.

In `discovery.types.ts`, add to `FileSignals`:

```ts
parseError?: boolean;
```

In `scoring-constants.ts`, add to `CONFIDENCE_LEVELS`:

```ts
astPartial: 65,
```

In `tree-sitter-signals.ts`, after `const root = tree.rootNode;`:

```ts
const parseError = root.hasError();
```

Return:

```ts
confidence: parseError ? CONFIDENCE_LEVELS.astPartial : CONFIDENCE_LEVELS.astStructure,
parseError,
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/tree-sitter-signals.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/core/tree-sitter/index.ts \
  apps/web/src/server/modules/analysis/engine/core/discovery.types.ts \
  apps/web/src/server/modules/analysis/engine/core/scoring-constants.ts \
  apps/web/src/server/modules/analysis/engine/extractors/tree-sitter-signals.ts \
  apps/web/src/server/modules/analysis/engine/extractors/tree-sitter-signals.test.ts
git commit -m "fix(web): correct tree-sitter grammar registry"
```

---

### Task 0.5: Reuse parsers, add timeout, delete cursors

**Files:**
- Modify: `apps/web/src/server/core/tree-sitter/index.ts`
- Modify: `apps/web/src/server/modules/analysis/engine/extractors/tree-sitter-signals.ts`
- Test: `apps/web/src/server/core/tree-sitter/query-cache.test.ts` is created in Task 1.1; for this task, extend `tree-sitter-signals.test.ts`.

**Interfaces:**
- Consumes: `getParserForExt(ext: string): Promise<Parser>`
- Produces: `collectTreeSitterSignals` does not create a parser per file; every `TreeCursor` is deleted; every parser has a 1-second parse timeout.

- [ ] **Step 1: Write the failing test**

Append:

```ts
it("reuses one parser per extension", async () => {
  const first = await getParserForExt(".ts");
  const second = await getParserForExt(".ts");
  expect(first).toBe(second);
});
```

Import `getParserForExt` from `@/server/core/tree-sitter` in the test.

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/tree-sitter-signals.test.ts
```

Expected: FAIL because `getParserForExt` is not exported.

- [ ] **Step 3: Write the minimal implementation**

In `core/tree-sitter/index.ts`, add:

```ts
const parserCache = new Map<string, Promise<Parser>>();

export async function getParserForExt(ext: string): Promise<Parser> {
  const cached = parserCache.get(ext);
  if (cached != null) {
    return cached;
  }

  const created = createParser().then((parser) => {
    parser.setTimeoutMicros(1_000_000);
    return parser;
  });

  parserCache.set(ext, created);
  return created;
}

export async function disposeTreeSitter(): Promise<void> {
  for (const parserPromise of parserCache.values()) {
    const parser = await parserPromise.catch(() => null);
    parser?.delete();
  }
  parserCache.clear();
  languageCache.clear();
  runtimeInitPromise = null;
}
```

In `tree-sitter-signals.ts`, replace:

```ts
const parser = await createParser();
```

with:

```ts
const parser = await getParserForExt(ext);
```

Remove `parser.delete()` from the `finally` block. Keep `tree?.delete()`:

```ts
} finally {
  cursor?.delete();
  tree?.delete();
}
```

Declare `let cursor: Parser.TreeCursor | undefined;` before the `try` and assign it where `root.walk()` is called.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/tree-sitter-signals.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/core/tree-sitter/index.ts \
  apps/web/src/server/modules/analysis/engine/extractors/tree-sitter-signals.ts \
  apps/web/src/server/modules/analysis/engine/extractors/tree-sitter-signals.test.ts
git commit -m "perf(web): reuse tree-sitter parsers"
```

---

### Task 0.6: Align documentation with the current implementation

**Files:**
- Modify: `apps/web/README.md`
- Modify: `apps/web/content/docs/concepts/architecture.mdx`
- Modify: `apps/web/content/docs/concepts/documents.mdx`
- Modify: `apps/web/content/docs/concepts/metrics.mdx`
- Modify: `.agents/skills/analysis-engine/SKILL.md`

**Interfaces:**
- Consumes: nothing.
- Produces: documentation that does not promise call hierarchies, parameter extraction, symbol-level graph nodes, or an AST Sentinel before Milestones 3–4 land.

- [ ] **Step 1: Update the claims**

Make these exact replacements:

- `apps/web/README.md`: replace “symbols, interfaces, call trees, and import hierarchies” with “symbols, imports, and file-level dependency edges”.
- `apps/web/README.md`: replace the Sentinel bullet with “Sentinel Stage: Verifies user instructions for prompt injection before the AI pipeline runs.” Add a separate bullet: “Security scan: secretlint plus rule-based sink checks over the analyzed source.”
- `apps/web/content/docs/concepts/architecture.mdx`: replace “files, symbols, imports and dependency edges” with “files, top-level symbols, imports and file-level dependency edges”. Replace “Sentinel checks security invariants and dangerous sinks” with “Sentinel checks user instructions for prompt injection; security scanning uses secretlint and rule-based sink checks.”
- `apps/web/content/docs/concepts/documents.mdx`: replace “Symbols, imports and routes come from the AST” with “Symbols and imports come from Tree-sitter; routes currently use the framework regex fallback until Milestone 2 of the Tree-sitter query migration.” (Milestone 2 updates this sentence again.)
- `apps/web/content/docs/concepts/metrics.mdx`: replace “Cyclomatic complexity measures branching density per function” with “Complexity currently measures branching density per file; per-function complexity is added in Milestone 4 of the Tree-sitter query migration.”
- `.agents/skills/analysis-engine/SKILL.md`: replace “Phase 1: Sentinel Detection (AST injection & security findings via web-tree-sitter)” with “Phase 1: Sentinel Detection (prompt-injection check on user instructions; code security is secretlint plus rule-based sink checks)”.

- [ ] **Step 2: Run formatting**

Run:

```bash
bun run format
```

Expected: Biome rewrites only the files above.

- [ ] **Step 3: Verify no stale claims remain**

Run:

```bash
rg -n "call hierarchies|call trees|symbol node|AST injection" apps/web/README.md apps/web/content/docs .agents/skills/analysis-engine/SKILL.md
```

Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add apps/web/README.md \
  apps/web/content/docs/concepts/architecture.mdx \
  apps/web/content/docs/concepts/documents.mdx \
  apps/web/content/docs/concepts/metrics.mdx \
  .agents/skills/analysis-engine/SKILL.md
git commit -m "docs(web): align AST claims with implementation"
```

---

## Milestone 1 — Query runtime and TypeScript/JavaScript extraction

### Task 1.1: Add a query cache

**Files:**
- Create: `apps/web/src/server/core/tree-sitter/query-cache.ts`
- Create: `apps/web/src/server/core/tree-sitter/query-cache.test.ts`

**Interfaces:**
- Consumes: `loadLanguage(ext, spec)`, `LanguageSpec` from `./index`
- Produces:
  - `compileQuery(ext: string, spec: LanguageSpec, source: string): Promise<Parser.Query>`
  - `disposeQueries(): void`

- [ ] **Step 1: Write the failing test**

Create `query-cache.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";

import { getSpecByExt } from "./index";
import { compileQuery, disposeQueries } from "./query-cache";

const TS_QUERY = `
  (function_declaration name: (identifier) @fn.name) @fn
`;

describe("compileQuery", () => {
  afterEach(() => {
    disposeQueries();
  });

  it("caches one query object per extension and source", async () => {
    const spec = getSpecByExt(".ts");
    expect(spec).toBeDefined();

    const first = await compileQuery(".ts", spec!, TS_QUERY);
    const second = await compileQuery(".ts", spec!, TS_QUERY);

    expect(first).toBe(second);
  });

  it("rejects an invalid query instead of caching it", async () => {
    const spec = getSpecByExt(".ts");
    expect(spec).toBeDefined();

    await expect(compileQuery(".ts", spec!, "(not_a_real_node) @x")).rejects.toThrow();
    await expect(compileQuery(".ts", spec!, "(not_a_real_node) @x")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/core/tree-sitter/query-cache.test.ts
```

Expected: FAIL because `./query-cache` does not exist.

- [ ] **Step 3: Write the minimal implementation**

Create `query-cache.ts`:

```ts
import type Parser from "web-tree-sitter";

import { loadLanguage, type LanguageSpec } from "./index";

const cache = new Map<string, Promise<Parser.Query>>();

export async function compileQuery(
  ext: string,
  spec: LanguageSpec,
  source: string,
): Promise<Parser.Query> {
  const key = `${ext}\u0000${source}`;
  const cached = cache.get(key);
  if (cached != null) {
    return cached;
  }

  const compiled = (async () => {
    const language = await loadLanguage(ext, spec);
    return language.query(source);
  })().catch((error: unknown) => {
    cache.delete(key);
    throw error;
  });

  cache.set(key, compiled);
  return compiled;
}

export function disposeQueries(): void {
  for (const queryPromise of cache.values()) {
    queryPromise.then((query) => query.delete()).catch(() => undefined);
  }
  cache.clear();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/core/tree-sitter/query-cache.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/core/tree-sitter/query-cache.ts \
  apps/web/src/server/core/tree-sitter/query-cache.test.ts
git commit -m "feat(web): add tree-sitter query cache"
```

---

### Task 1.2: Define the language query contract and capture helpers

**Files:**
- Create: `apps/web/src/server/modules/analysis/engine/extractors/queries/types.ts`
- Create: `apps/web/src/server/modules/analysis/engine/extractors/queries/captures.ts`
- Create: `apps/web/src/server/modules/analysis/engine/extractors/queries/captures.test.ts`

**Interfaces:**
- Consumes: `Parser.QueryCapture`, `Parser.SyntaxNode`
- Produces:
  - `LanguageQuerySpec`
  - `capturesByName(captures): Map<string, Parser.SyntaxNode[]>`
  - `firstCapture(map, name): Parser.SyntaxNode | undefined`

- [ ] **Step 1: Write the failing test**

Create `captures.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type Parser from "web-tree-sitter";

import { capturesByName, firstCapture } from "./captures";

const node = (text: string) => ({ text }) as Parser.SyntaxNode;

describe("capturesByName", () => {
  it("groups captures by name and preserves order", () => {
    const map = capturesByName([
      { name: "import.named", node: node("a") },
      { name: "import.source", node: node("./x") },
      { name: "import.named", node: node("b") },
    ]);

    expect(map.get("import.named")?.map((item) => item.text)).toEqual(["a", "b"]);
    expect(firstCapture(map, "import.source")?.text).toBe("./x");
    expect(firstCapture(map, "missing")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/queries/captures.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Write the minimal implementation**

Create `types.ts`:

```ts
import type Parser from "web-tree-sitter";

export type LanguageQuerySpec = {
  symbols: string;
  imports: string;
  exports: string;
  routes: string;
  entrypoints: string;
  complexity?: string;
  calls?: string;
  nestingNodeTypes: string[];
  detectFramework?: (imports: Set<string>) => string | undefined;
  normalizeRouteMethod?: (raw: string) => string;
  isExported?: (node: Parser.SyntaxNode, name: string) => boolean;
};
```

Create `captures.ts`:

```ts
import type Parser from "web-tree-sitter";

export function capturesByName(
  captures: Parser.QueryCapture[],
): Map<string, Parser.SyntaxNode[]> {
  const map = new Map<string, Parser.SyntaxNode[]>();

  for (const capture of captures) {
    const nodes = map.get(capture.name);
    if (nodes == null) {
      map.set(capture.name, [capture.node]);
    } else {
      nodes.push(capture.node);
    }
  }

  return map;
}

export function firstCapture(
  map: Map<string, Parser.SyntaxNode[]>,
  name: string,
): Parser.SyntaxNode | undefined {
  return map.get(name)?.[0];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/queries/captures.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/modules/analysis/engine/extractors/queries/types.ts \
  apps/web/src/server/modules/analysis/engine/extractors/queries/captures.ts \
  apps/web/src/server/modules/analysis/engine/extractors/queries/captures.test.ts
git commit -m "feat(web): add tree-sitter query capture helpers"
```

---

### Task 1.3: Add the TypeScript/TSX query spec

**Files:**
- Create: `apps/web/src/server/modules/analysis/engine/extractors/queries/typescript.ts`
- Test: `apps/web/src/server/modules/analysis/engine/extractors/queries/typescript.test.ts`

**Interfaces:**
- Consumes: `LanguageQuerySpec`
- Produces: `typescriptQuerySpec: LanguageQuerySpec`

- [ ] **Step 1: Write the failing test**

Create `typescript.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { createParser, getSpecByExt, loadLanguage } from "@/server/core/tree-sitter";

import { typescriptQuerySpec } from "./typescript";

const FIXTURE = [
  'import { Hono } from "hono";',
  "export function greet(name: string) { return name; }",
  "class UserService { run() {} }",
  "interface UserRepo { find(): void }",
  "type Id = string;",
  "enum Role { Admin }",
  'const app = new Hono(); app.get("/users", handler);',
].join("\n");

describe("typescriptQuerySpec", () => {
  it("captures real symbol names", async () => {
    const spec = getSpecByExt(".ts");
    expect(spec).toBeDefined();

    const parser = await createParser();
    const language = await loadLanguage(".ts", spec!);
    parser.setLanguage(language);
    const tree = parser.parse(FIXTURE);
    const query = language.query(typescriptQuerySpec.symbols);

    const names = query
      .captures(tree.rootNode)
      .filter((capture) => /^symbol\.[a-z]+\.name$/u.test(capture.name))
      .map((capture) => capture.node.text);

    expect(names).toEqual(["greet", "UserService", "run", "UserRepo", "Id", "Role"]);

    query.delete();
    tree.delete();
    parser.delete();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/queries/typescript.test.ts
```

Expected: FAIL because `typescript.ts` does not exist.

- [ ] **Step 3: Write the minimal implementation**

Create `typescript.ts`:

```ts
import type { LanguageQuerySpec } from "./types";

const SYMBOLS = `
  (function_declaration name: (identifier) @symbol.function.name) @symbol.function
  (generator_function_declaration name: (identifier) @symbol.function.name) @symbol.function
  (class_declaration name: (type_identifier) @symbol.class.name) @symbol.class
  (abstract_class_declaration name: (type_identifier) @symbol.class.name) @symbol.class
  (interface_declaration name: (type_identifier) @symbol.interface.name) @symbol.interface
  (type_alias_declaration name: (type_identifier) @symbol.type.name) @symbol.type
  (enum_declaration name: (identifier) @symbol.enum.name) @symbol.enum
  (method_definition name: (property_identifier) @symbol.method.name) @symbol.method
  (variable_declarator name: (identifier) @symbol.const.name value: (arrow_function)) @symbol.const
  (variable_declarator name: (identifier) @symbol.const.name value: (function_expression)) @symbol.const
`;

const IMPORTS = `
  (import_statement source: (string (string_fragment) @import.source)) @import.statement
  (import_statement
    (import_clause (identifier) @import.default)
    source: (string (string_fragment) @import.source)) @import.statement
  (import_statement
    (import_clause (namespace_import (identifier) @import.namespace))
    source: (string (string_fragment) @import.source)) @import.statement
  (import_statement
    (import_clause (named_imports (import_specifier name: (identifier) @import.named)))
    source: (string (string_fragment) @import.source)) @import.statement
  (call_expression function: (identifier) @import.require.fn arguments: (arguments (string (string_fragment) @import.source)) (#eq? @import.require.fn "require")) @import.require
  (call_expression function: (import) arguments: (arguments (string (string_fragment) @import.source))) @import.dynamic
`;

const EXPORTS = `
  (export_statement declaration: (function_declaration name: (identifier) @export.name)) @export.statement
  (export_statement declaration: (class_declaration name: (type_identifier) @export.name)) @export.statement
  (export_statement declaration: (lexical_declaration (variable_declarator name: (identifier) @export.name))) @export.statement
  (export_statement (export_clause (export_specifier name: (identifier) @export.name))) @export.statement
  (export_statement source: (string (string_fragment) @export.source)) @export.statement
`;

const ROUTES = `
  (call_expression
    function: (member_expression
      object: (identifier) @route.receiver
      property: (property_identifier) @route.method)
    arguments: (arguments (string (string_fragment) @route.path))
    (#match? @route.method "^(get|post|put|patch|delete|options|head)$")
    (#match? @route.receiver "^(app|router|server|api|fastify|route|r)$")) @route.call
`;

const ENTRYPOINTS = `
  (call_expression function: (identifier) @entrypoint.runtime (#match? @entrypoint.runtime "^(serve|createServer|listen)$")) @entrypoint.call
  (new_expression constructor: (identifier) @entrypoint.runtime (#eq? @entrypoint.runtime "Hono")) @entrypoint.new
`;

const COMPLEXITY = `
  (if_statement) @complexity.branch
  (for_statement) @complexity.branch
  (for_in_statement) @complexity.branch
  (while_statement) @complexity.branch
  (do_statement) @complexity.branch
  (switch_statement) @complexity.branch
  (catch_clause) @complexity.branch
  (ternary_expression) @complexity.branch
  (binary_expression operator: "&&") @complexity.branch
  (binary_expression operator: "||") @complexity.branch
`;

const CALLS = `
  (call_expression function: (identifier) @call.name) @call.expression
  (call_expression function: (member_expression object: (identifier) @call.object property: (property_identifier) @call.method)) @call.expression
  (new_expression constructor: (identifier) @call.constructor) @call.expression
`;

export const typescriptQuerySpec: LanguageQuerySpec = {
  calls: CALLS,
  complexity: COMPLEXITY,
  detectFramework: (imports) => {
    if ([...imports].some((specifier) => specifier === "hono" || specifier.startsWith("hono/"))) {
      return "Hono";
    }
    if (imports.has("express")) {
      return "Express";
    }
    if ([...imports].some((specifier) => specifier === "fastify" || specifier.startsWith("fastify/"))) {
      return "Fastify";
    }
    return undefined;
  },
  entrypoints: ENTRYPOINTS,
  exports: EXPORTS,
  imports: IMPORTS,
  nestingNodeTypes: [
    "function_declaration",
    "method_definition",
    "arrow_function",
    "class_declaration",
    "if_statement",
    "for_statement",
    "for_in_statement",
    "while_statement",
    "do_statement",
    "switch_statement",
    "catch_clause",
  ],
  routes: ROUTES,
  symbols: SYMBOLS,
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/queries/typescript.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/modules/analysis/engine/extractors/queries/typescript.ts \
  apps/web/src/server/modules/analysis/engine/extractors/queries/typescript.test.ts
git commit -m "feat(web): add typescript tree-sitter query spec"
```

---

### Task 1.4: Build the query signal collector

**Files:**
- Create: `apps/web/src/server/modules/analysis/engine/extractors/query-signals.ts`
- Test: `apps/web/src/server/modules/analysis/engine/extractors/query-signals.test.ts`

**Interfaces:**
- Consumes: `compileQuery`, `getParserForExt`, `loadLanguage`, `getSpecByExt`, `LanguageQuerySpec`
- Produces: `collectQuerySignals(file: RepositoryFile, ext: string, querySpec: LanguageQuerySpec): Promise<FileSignals | null>`

- [ ] **Step 1: Write the failing test**

Create `query-signals.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { collectQuerySignals } from "./query-signals";
import { typescriptQuerySpec } from "./queries/typescript";

const FIXTURE = [
  'import { Hono } from "hono";',
  "export function greet(name: string) { return name; }",
  "function internal() {}",
  "class UserService { run() {} }",
  'const app = new Hono(); app.get("/users", handler);',
].join("\n");

describe("collectQuerySignals", () => {
  it("normalizes symbols, imports, exports and routes", async () => {
    const result = await collectQuerySignals(
      { content: FIXTURE, path: "src/api.ts" },
      ".ts",
      typescriptQuerySpec,
    );

    expect(result).not.toBeNull();
    expect(result?.symbols.map((symbol) => symbol.name)).toEqual([
      "greet",
      "internal",
      "UserService",
      "run",
    ]);
    expect(result?.symbols.find((symbol) => symbol.name === "greet")?.exported).toBe(true);
    expect(result?.symbols.find((symbol) => symbol.name === "internal")?.exported).toBe(false);
    expect(result?.imports).toEqual(["hono"]);
    expect(result?.exports).toBe(1);
    expect(result?.routes).toEqual([
      expect.objectContaining({ framework: "Hono", method: "GET", path: "/users" }),
    ]);
    expect(result?.parseError).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/query-signals.test.ts
```

Expected: FAIL because `query-signals.ts` does not exist.

- [ ] **Step 3: Write the minimal implementation**

Create `query-signals.ts`:

```ts
import type Parser from "web-tree-sitter";

import {
  getParserForExt,
  getSpecByExt,
  type LanguageSpec,
  loadLanguage,
  type SymbolKind,
} from "@/server/core/tree-sitter";
import { compileQuery } from "@/server/core/tree-sitter/query-cache";

import type {
  EntrypointRef,
  FileSignals,
  ImportKind,
  ImportRef,
  RepositoryFile,
  RouteRef,
  SymbolRef,
} from "../core/discovery.types";
import { collectFrameworkFactsFromTokens } from "../core/framework-catalog";
import { CONFIDENCE_LEVELS } from "../core/scoring-constants";
import { capturesByName, firstCapture } from "./queries/captures";
import type { LanguageQuerySpec } from "./queries/types";

const ROUTE_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]);

const IMPORT_KIND_BY_CAPTURE: Record<string, ImportKind> = {
  "import.default": "default",
  "import.dynamic": "dynamic",
  "import.named": "named",
  "import.namespace": "namespace",
  "import.reexport": "reexport",
  "import.require": "require",
  "import.side_effect": "side-effect",
};

function stripQuotes(text: string): string {
  return text.replace(/^["'`]|["'`]$/gu, "");
}

async function compileOptionalQuery(
  ext: string,
  spec: LanguageSpec,
  source: string,
): Promise<Parser.Query | null> {
  if (source.trim().length === 0) {
    return null;
  }
  return compileQuery(ext, spec, source);
}

async function collectExportedNames(
  ext: string,
  spec: LanguageSpec,
  source: string,
  root: Parser.SyntaxNode,
): Promise<Set<string>> {
  const names = new Set<string>();
  const query = await compileOptionalQuery(ext, spec, source);
  if (query == null) {
    return names;
  }

  for (const capture of query.captures(root)) {
    if (capture.name === "export.name") {
      names.add(capture.node.text);
    }
  }

  return names;
}

function importKindFromCaptures(names: Iterable<string>): ImportKind {
  for (const name of names) {
    const kind = IMPORT_KIND_BY_CAPTURE[name];
    if (kind != null) {
      return kind;
    }
  }
  return "side-effect";
}

function computeMaxNesting(root: Parser.SyntaxNode, nestingNodeTypes: string[]): number {
  const nesting = new Set(nestingNodeTypes);
  let maxNesting = 0;
  let currentNesting = 0;
  const cursor = root.walk();

  try {
    let reachedRoot = false;
    while (!reachedRoot) {
      if (nesting.has(cursor.nodeType)) {
        currentNesting++;
        maxNesting = Math.max(maxNesting, currentNesting);
      }

      if (cursor.gotoFirstChild()) {
        continue;
      }

      if (cursor.gotoNextSibling()) {
        continue;
      }

      let backtrack = true;
      while (backtrack) {
        if (!cursor.gotoParent()) {
          reachedRoot = true;
          backtrack = false;
        } else {
          if (nesting.has(cursor.nodeType)) {
            currentNesting = Math.max(0, currentNesting - 1);
          }
          if (cursor.gotoNextSibling()) {
            backtrack = false;
          }
        }
      }
    }
  } finally {
    cursor.delete();
  }

  return maxNesting;
}

export async function collectQuerySignals(
  file: RepositoryFile,
  ext: string,
  querySpec: LanguageQuerySpec,
): Promise<FileSignals | null> {
  const languageSpec = getSpecByExt(ext);
  if (languageSpec == null) {
    return null;
  }

  let tree: Parser.Tree | undefined;

  try {
    const parser = await getParserForExt(ext);
    const language = await loadLanguage(ext, languageSpec);
    parser.setLanguage(language);
    tree = parser.parse(file.content);
    const root = tree.rootNode;

    const symbols: SymbolRef[] = [];
    const imports = new Set<string>();
    const importDetails: ImportRef[] = [];
    const routes: RouteRef[] = [];
    const entrypoints: EntrypointRef[] = [];

    const exportedNames = await collectExportedNames(
      ext,
      languageSpec,
      querySpec.exports,
      root,
    );

    const symbolQuery = await compileOptionalQuery(ext, languageSpec, querySpec.symbols);
    if (symbolQuery != null) {
      for (const match of symbolQuery.matches(root)) {
        const captures = capturesByName(match.captures);

        for (const [captureName, nameNodes] of captures) {
          const parsed = /^symbol\.([a-z]+)\.name$/u.exec(captureName);
          if (parsed == null) {
            continue;
          }

          const kind = parsed[1] as SymbolKind;
          const declaration = firstCapture(captures, `symbol.${kind}`);

          for (const nameNode of nameNodes) {
            const name = nameNode.text;
            const exported =
              exportedNames.has(name) ||
              querySpec.isExported?.(declaration ?? nameNode, name) === true ||
              declaration?.parent?.type === "export_statement";

            symbols.push({
              confidence: CONFIDENCE_LEVELS.astSymbol,
              exported,
              kind,
              line: (declaration ?? nameNode).startPosition.row + 1,
              name,
              path: file.path,
            });
          }
        }
      }
    }

    const importQuery = await compileOptionalQuery(ext, languageSpec, querySpec.imports);
    if (importQuery != null) {
      const seenImportDetails = new Set<string>();

      for (const match of importQuery.matches(root)) {
        const captures = capturesByName(match.captures);
        const sourceNode = firstCapture(captures, "import.source");
        if (sourceNode == null) {
          continue;
        }

        const source = stripQuotes(sourceNode.text);
        imports.add(source);
        const line = (firstCapture(captures, "import.statement") ?? sourceNode).startPosition.row + 1;
        const names = [
          ...(captures.get("import.default") ?? []),
          ...(captures.get("import.named") ?? []),
          ...(captures.get("import.namespace") ?? []),
        ].map((node) => node.text);
        const kind = importKindFromCaptures(captures.keys());
        const key = `${kind}:${source}:${names.join(",")}`;
        if (seenImportDetails.has(key)) {
          continue;
        }
        seenImportDetails.add(key);

        importDetails.push({
          kind,
          line,
          names,
          source,
        });
      }
    }

    const routeQuery = await compileOptionalQuery(ext, languageSpec, querySpec.routes);
    if (routeQuery != null) {
      const framework = querySpec.detectFramework?.(imports);
      const seen = new Set<string>();

      for (const match of routeQuery.matches(root)) {
        const captures = capturesByName(match.captures);
        const methodNode = firstCapture(captures, "route.method");
        const pathNode = firstCapture(captures, "route.path");
        if (methodNode == null || pathNode == null) {
          continue;
        }

        const rawMethod = methodNode.text;
        const method = (querySpec.normalizeRouteMethod?.(rawMethod) ?? rawMethod).toUpperCase();
        if (!ROUTE_METHODS.has(method)) {
          continue;
        }

        const routePath = stripQuotes(pathNode.text);
        const key = `${method}:${routePath}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);

        routes.push({
          confidence: CONFIDENCE_LEVELS.astRoute,
          framework,
          kind: "http",
          line: methodNode.startPosition.row + 1,
          method,
          path: routePath,
          sourcePath: file.path,
        });
      }
    }

    const entrypointQuery = await compileOptionalQuery(ext, languageSpec, querySpec.entrypoints);
    if (entrypointQuery != null) {
      for (const capture of entrypointQuery.captures(root)) {
        if (capture.name !== "entrypoint.runtime") {
          continue;
        }
        entrypoints.push({
          confidence: CONFIDENCE_LEVELS.astRoute,
          kind: "runtime",
          path: file.path,
          reason: `Tree-sitter entrypoint: ${capture.node.text.split("\n")[0] ?? ""}`,
        });
      }
    }

    const complexityQuery = await compileOptionalQuery(ext, languageSpec, querySpec.complexity ?? "");
    const complexity =
      complexityQuery?.captures(root).filter((capture) => capture.name === "complexity.branch")
        .length ?? 0;

    const frameworkHints = collectFrameworkFactsFromTokens(
      [...imports, file.path, ...symbols.map((symbol) => symbol.name)],
      file.path,
      78,
    );

    return {
      analysisMode: "tree-sitter",
      apiSurface: routes.length,
      complexityMetrics: {
        complexity,
        maxNesting: computeMaxNesting(root, querySpec.nestingNodeTypes),
      },
      confidence: root.hasError() ? CONFIDENCE_LEVELS.astPartial : CONFIDENCE_LEVELS.astStructure,
      entrypointHint: entrypoints.length > 0,
      entrypointRefs: entrypoints,
      exports: new Set(symbols.filter((symbol) => symbol.exported).map((symbol) => symbol.name))
        .size,
      frameworkHints,
      importDetails,
      imports: Array.from(imports),
      parseError: root.hasError(),
      path: file.path,
      routes,
      source: "extraction",
      symbols,
    };
  } finally {
    tree?.delete();
  }
}
```

Add `ImportKind` and `ImportRef` to `discovery.types.ts` now. Task 1.6 adds the symbol-level fields on top of these:

```ts
export type ImportKind =
  | "default"
  | "dynamic"
  | "named"
  | "namespace"
  | "reexport"
  | "require"
  | "side-effect";

export type ImportRef = {
  kind: ImportKind;
  line?: number;
  names?: string[];
  source: string;
};
```

Add to `FileSignals`:

```ts
importDetails?: ImportRef[];
parseError?: boolean;
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/query-signals.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/modules/analysis/engine/extractors/query-signals.ts \
  apps/web/src/server/modules/analysis/engine/extractors/query-signals.test.ts \
  apps/web/src/server/modules/analysis/engine/core/discovery.types.ts
git commit -m "feat(web): normalize tree-sitter query captures"
```

---

### Task 1.5: Switch TypeScript/TSX signals to the query collector

**Files:**
- Create: `apps/web/src/server/modules/analysis/engine/extractors/queries/index.ts`
- Modify: `apps/web/src/server/modules/analysis/engine/extractors/tree-sitter-signals.ts`
- Test: `apps/web/src/server/modules/analysis/engine/extractors/tree-sitter-signals.test.ts`

**Interfaces:**
- Consumes: `typescriptQuerySpec`, `collectQuerySignals`
- Produces: `collectTreeSitterSignals` dispatches `.ts`/`.tsx`/`.mts`/`.cts` to the query path and keeps the legacy walker for other extensions until Milestone 2.

- [ ] **Step 1: Write the failing test**

Append:

```ts
it("uses the query path for TypeScript and preserves exact names", async () => {
  const result = await collectTreeSitterSignals({
    content: 'import { Hono } from "hono"; export function greet(name: string) { return name; }',
    path: "src/sample.ts",
  });

  expect(result?.analysisMode).toBe("tree-sitter");
  expect(result?.symbols[0]?.name).toBe("greet");
  expect(result?.parseError).toBe(false);
  expect(result?.importDetails).toContainEqual(
    expect.objectContaining({ kind: "named", source: "hono" }),
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/tree-sitter-signals.test.ts
```

Expected: FAIL. The legacy walker leaves `importDetails` undefined.

- [ ] **Step 3: Write the minimal implementation**

Create `queries/index.ts`:

```ts
import type { LanguageQuerySpec } from "./types";
import { typescriptQuerySpec } from "./typescript";

export const QUERY_SPECS: Partial<Record<string, LanguageQuerySpec>> = {
  ".cts": typescriptQuerySpec,
  ".mts": typescriptQuerySpec,
  ".ts": typescriptQuerySpec,
  ".tsx": typescriptQuerySpec,
};
```

In `tree-sitter-signals.ts`, rename the existing function to `collectLegacySignals(file, ext, spec)` and remove its internal `getFileExtension`/`getSpecByExt` lookups (the dispatcher already computed them). Then add a dispatcher:

```ts
export async function collectTreeSitterSignals(
  file: RepositoryFile,
): Promise<FileSignals | null> {
  const ext = getFileExtension(file.path);
  const spec = getSpecByExt(ext);
  if (spec == null) {
    return null;
  }

  const querySpec = QUERY_SPECS[ext];

  try {
    if (querySpec != null) {
      return await collectQuerySignals(file, ext, querySpec);
    }
    return await collectLegacySignals(file, ext, spec);
  } catch (error) {
    appLogger.error({
      error,
      ext,
      msg: "Tree-sitter extraction failed; falling back to non-AST analysis",
      path: file.path,
    });
    return null;
  }
}
```

Import:

```ts
import { collectQuerySignals } from "./query-signals";
import { QUERY_SPECS } from "./queries";
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/tree-sitter-signals.test.ts
```

Expected: PASS after Task 1.6 adds `signature`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/modules/analysis/engine/extractors/queries/index.ts \
  apps/web/src/server/modules/analysis/engine/extractors/tree-sitter-signals.ts \
  apps/web/src/server/modules/analysis/engine/extractors/tree-sitter-signals.test.ts
git commit -m "feat(web): route typescript extraction through tree-sitter queries"
```

---

### Task 1.6: Extend symbol and signal types

**Files:**
- Modify: `apps/web/src/server/modules/analysis/engine/core/discovery.types.ts`
- Modify: `apps/web/src/server/modules/analysis/engine/extractors/query-signals.ts`
- Test: `apps/web/src/server/modules/analysis/engine/extractors/query-signals.test.ts`

**Interfaces:**
- Consumes: `SymbolRef`
- Produces:
  - `SymbolRef.signature?: string`
  - `SymbolRef.parameters?: string`
  - `SymbolRef.returnType?: string`
  - `SymbolRef.visibility?: "public" | "protected" | "private" | "internal" | "package"`
  - `SymbolRef.container?: string`
  - `FileSignals.functionComplexities?: Array<{ complexity: number; line: number; maxNesting: number; name: string }>`

- [ ] **Step 1: Write the failing test**

Append to `query-signals.test.ts`:

```ts
it("records the raw signature and parameters for a function", async () => {
  const result = await collectQuerySignals(
    {
      content: "export function greet(name: string, age?: number): string { return name; }",
      path: "src/sample.ts",
    },
    ".ts",
    typescriptQuerySpec,
  );

  const symbol = result?.symbols.find((item) => item.name === "greet");
  expect(symbol?.signature).toContain("greet(name: string");
  expect(symbol?.parameters).toBe("(name: string, age?: number)");
  expect(symbol?.returnType).toBe(": string");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/query-signals.test.ts
```

Expected: FAIL because `signature`, `parameters`, and `returnType` are `undefined`.

- [ ] **Step 3: Write the minimal implementation**

Add the optional fields to `SymbolRef`:

```ts
export type SymbolRef = {
  confidence: number;
  container?: string;
  exported: boolean;
  kind: SymbolKind;
  line?: number;
  name: string;
  parameters?: string;
  path: string;
  returnType?: string;
  signature?: string;
  visibility?: "internal" | "package" | "private" | "protected" | "public";
};
```

Add to `FileSignals`:

```ts
functionComplexities?: Array<{
  complexity: number;
  line: number;
  maxNesting: number;
  name: string;
}>;
```

In `query-signals.ts`, when pushing a symbol:

```ts
const parameters = declaration?.childForFieldName("parameters")?.text;
const returnType = declaration?.childForFieldName("return_type")?.text;
const container =
  kind === "method" ? declaration?.parent?.parent?.childForFieldName("name")?.text : undefined;

symbols.push({
  confidence: CONFIDENCE_LEVELS.astSymbol,
  container,
  exported,
  kind,
  line: (declaration ?? nameNode).startPosition.row + 1,
  name,
  parameters,
  path: file.path,
  returnType,
  signature: parameters == null ? name : `${name}${parameters}${returnType ?? ""}`,
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/query-signals.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/modules/analysis/engine/core/discovery.types.ts \
  apps/web/src/server/modules/analysis/engine/extractors/query-signals.ts \
  apps/web/src/server/modules/analysis/engine/extractors/query-signals.test.ts
git commit -m "feat(web): add symbol signatures to tree-sitter signals"
```

---

### Task 1.7: Use import details in evidence and dedupe route inventory

**Files:**
- Modify: `apps/web/src/server/modules/analysis/engine/core/evidence-support.ts`
- Test: `apps/web/src/server/modules/analysis/engine/core/evidence-support.test.ts`

**Interfaces:**
- Consumes: `FileSignals.importDetails`, `FileSignals.imports`
- Produces: dependency edges are built from `importDetails` when present; `buildRouteInventory` returns unique HTTP routes.

- [ ] **Step 1: Write the failing test**

Append to `evidence-support.test.ts`:

```ts
it("prefers importDetails over the legacy import list", () => {
  const tracking = createDependencyTracking();
  resolveImportEdges(
    "src/a.ts",
    ["legacy-only", "./b"],
    {
      aliasRules: [],
      filesByBaseName: new Map([["b.ts", ["src/b.ts"]]]),
      fileSet: new Set(["src/a.ts", "src/b.ts"]),
    },
    tracking,
  );

  expect(tracking.edges.map((edge) => edge.specifier)).toContain("./b");
});

it("deduplicates route inventory by method and path", () => {
  const inventory = buildRouteInventory({
    frameworkFacts: [],
    routes: [
      { confidence: 70, kind: "http", method: "GET", path: "/x", sourcePath: "src/a.ts" },
      { confidence: 70, kind: "http", method: "GET", path: "/x", sourcePath: "src/a.ts" },
      { confidence: 70, kind: "http", method: "POST", path: "/x", sourcePath: "src/a.ts" },
    ],
  });

  expect(inventory.estimatedOperations).toBe(2);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/core/evidence-support.test.ts
```

Expected: FAIL. `createDependencyTracking` is not exported and route inventory returns 3.

- [ ] **Step 3: Write the minimal implementation**

Export `createDependencyTracking` from `evidence-support.ts`:

```ts
export function createDependencyTracking(): DependencyTracking {
  // existing body
}
```

In `collectFileEvidence`, replace `signals.imports` with:

```ts
const importSpecifiers =
  signals.importDetails?.map((detail) => detail.source) ?? signals.imports;

resolveImportEdges(file.path, importSpecifiers, lookups, tracking);
```

In `buildRouteInventory`, dedupe before mapping:

```ts
const seenRoutes = new Set<string>();
const httpRoutes = primaryRoutes
  .filter((route) => route.kind === "http" && route.method != null)
  .filter((route) => {
    const key = `${route.method}:${route.path}`;
    if (seenRoutes.has(key)) {
      return false;
    }
    seenRoutes.add(key);
    return true;
  })
  .map((route) => ({
    method: route.method ?? "GET",
    path: route.path,
    sourcePath: route.sourcePath,
  }));
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/core/evidence-support.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/modules/analysis/engine/core/evidence-support.ts \
  apps/web/src/server/modules/analysis/engine/core/evidence-support.test.ts
git commit -m "fix(web): dedupe route inventory and use import details"
```

---

## Milestone 2 — Polyglot query specs

Each task in this milestone adds one language spec. The collector from Task 1.4 is generic; only the query strings, fixture, and registry entry change.

### Task 2.1: Add the JavaScript/JSX/MJS/CJS query spec

**Files:**
- Create: `apps/web/src/server/modules/analysis/engine/extractors/queries/javascript.ts`
- Modify: `apps/web/src/server/modules/analysis/engine/extractors/queries/index.ts`
- Test: `apps/web/src/server/modules/analysis/engine/extractors/queries/javascript.test.ts`

**Interfaces:**
- Consumes: `LanguageQuerySpec`
- Produces: `javascriptQuerySpec: LanguageQuerySpec`

- [ ] **Step 1: Write the failing test**

Create `javascript.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { createParser, getSpecByExt, loadLanguage } from "@/server/core/tree-sitter";

import { javascriptQuerySpec } from "./javascript";

const FIXTURE = [
  'import express from "express";',
  "export function a() {}",
  "function b() {}",
  "class C { run() {} }",
  "const d = () => 1;",
  'const app = express(); app.get("/x", handler);',
].join("\n");

describe("javascriptQuerySpec", () => {
  it("captures JavaScript declarations and routes", async () => {
    const spec = getSpecByExt(".js");
    expect(spec).toBeDefined();

    const parser = await createParser();
    const language = await loadLanguage(".js", spec!);
    parser.setLanguage(language);
    const tree = parser.parse(FIXTURE);

    const symbolQuery = language.query(javascriptQuerySpec.symbols);
    const names = symbolQuery
      .captures(tree.rootNode)
      .filter((capture) => /^symbol\.[a-z]+\.name$/u.test(capture.name))
      .map((capture) => capture.node.text);

    expect(names).toEqual(["a", "b", "C", "run", "d"]);

    symbolQuery.delete();
    tree.delete();
    parser.delete();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/queries/javascript.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Write the minimal implementation**

Create `javascript.ts`:

```ts
import type { LanguageQuerySpec } from "./types";

const SYMBOLS = `
  (function_declaration name: (identifier) @symbol.function.name) @symbol.function
  (generator_function_declaration name: (identifier) @symbol.function.name) @symbol.function
  (class_declaration name: (identifier) @symbol.class.name) @symbol.class
  (method_definition name: (property_identifier) @symbol.method.name) @symbol.method
  (variable_declarator name: (identifier) @symbol.const.name value: (arrow_function)) @symbol.const
  (variable_declarator name: (identifier) @symbol.const.name value: (function_expression)) @symbol.const
`;

const IMPORTS = `
  (import_statement source: (string (string_fragment) @import.source)) @import.statement
  (import_statement
    (import_clause (identifier) @import.default)
    source: (string (string_fragment) @import.source)) @import.statement
  (import_statement
    (import_clause (namespace_import (identifier) @import.namespace))
    source: (string (string_fragment) @import.source)) @import.statement
  (import_statement
    (import_clause (named_imports (import_specifier name: (identifier) @import.named)))
    source: (string (string_fragment) @import.source)) @import.statement
  (call_expression function: (identifier) @import.require.fn arguments: (arguments (string (string_fragment) @import.source)) (#eq? @import.require.fn "require")) @import.require
  (call_expression function: (import) arguments: (arguments (string (string_fragment) @import.source))) @import.dynamic
`;

const EXPORTS = `
  (export_statement declaration: (function_declaration name: (identifier) @export.name)) @export.statement
  (export_statement declaration: (class_declaration name: (identifier) @export.name)) @export.statement
  (export_statement declaration: (lexical_declaration (variable_declarator name: (identifier) @export.name))) @export.statement
  (export_statement (export_clause (export_specifier name: (identifier) @export.name))) @export.statement
`;

const ROUTES = `
  (call_expression
    function: (member_expression
      object: (identifier) @route.receiver
      property: (property_identifier) @route.method)
    arguments: (arguments (string (string_fragment) @route.path))
    (#match? @route.method "^(get|post|put|patch|delete|options|head)$")
    (#match? @route.receiver "^(app|router|server|api|fastify|route|r)$")) @route.call
`;

export const javascriptQuerySpec: LanguageQuerySpec = {
  complexity: `
    (if_statement) @complexity.branch
    (for_statement) @complexity.branch
    (for_in_statement) @complexity.branch
    (while_statement) @complexity.branch
    (do_statement) @complexity.branch
    (switch_statement) @complexity.branch
    (catch_clause) @complexity.branch
    (ternary_expression) @complexity.branch
    (binary_expression operator: "&&") @complexity.branch
    (binary_expression operator: "||") @complexity.branch
  `,
  calls: `
    (call_expression function: (identifier) @call.name) @call.expression
    (call_expression function: (member_expression object: (identifier) @call.object property: (property_identifier) @call.method)) @call.expression
    (new_expression constructor: (identifier) @call.constructor) @call.expression
  `,
  detectFramework: (imports) => {
    if (imports.has("express")) {
      return "Express";
    }
    if ([...imports].some((specifier) => specifier === "fastify" || specifier.startsWith("fastify/"))) {
      return "Fastify";
    }
    return undefined;
  },
  entrypoints: `
    (call_expression function: (identifier) @entrypoint.runtime (#match? @entrypoint.runtime "^(serve|createServer|listen)$")) @entrypoint.call
  `,
  exports: EXPORTS,
  imports: IMPORTS,
  nestingNodeTypes: [
    "function_declaration",
    "method_definition",
    "arrow_function",
    "class_declaration",
    "if_statement",
    "for_statement",
    "for_in_statement",
    "while_statement",
    "do_statement",
    "switch_statement",
    "catch_clause",
  ],
  routes: ROUTES,
  symbols: SYMBOLS,
};
```

Update `queries/index.ts`:

```ts
import { javascriptQuerySpec } from "./javascript";
import { typescriptQuerySpec } from "./typescript";

export const QUERY_SPECS: Partial<Record<string, LanguageQuerySpec>> = {
  ".cjs": javascriptQuerySpec,
  ".cts": typescriptQuerySpec,
  ".js": javascriptQuerySpec,
  ".jsx": javascriptQuerySpec,
  ".mjs": javascriptQuerySpec,
  ".mts": typescriptQuerySpec,
  ".ts": typescriptQuerySpec,
  ".tsx": typescriptQuerySpec,
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/queries/javascript.test.ts \
  src/server/modules/analysis/engine/extractors/tree-sitter-signals.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/modules/analysis/engine/extractors/queries/javascript.ts \
  apps/web/src/server/modules/analysis/engine/extractors/queries/javascript.test.ts \
  apps/web/src/server/modules/analysis/engine/extractors/queries/index.ts
git commit -m "feat(web): add javascript tree-sitter query spec"
```

---

### Task 2.2: Add the Python query spec

**Files:**
- Create: `apps/web/src/server/modules/analysis/engine/extractors/queries/python.ts`
- Modify: `apps/web/src/server/modules/analysis/engine/extractors/queries/index.ts`
- Test: `apps/web/src/server/modules/analysis/engine/extractors/queries/python.test.ts`

**Interfaces:**
- Consumes: `LanguageQuerySpec`
- Produces: `pythonQuerySpec: LanguageQuerySpec`

- [ ] **Step 1: Write the failing test**

Create `python.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { createParser, getSpecByExt, loadLanguage } from "@/server/core/tree-sitter";

import { pythonQuerySpec } from "./python";

const FIXTURE = [
  "import os",
  "from fastapi import FastAPI",
  "",
  '@app.get("/x")',
  "def handler(a: int, b: str) -> str:",
  "    return a",
  "",
  "class User:",
  "    def run(self, x):",
  "        return x",
].join("\n");

describe("pythonQuerySpec", () => {
  it("captures Python declarations, imports and routes", async () => {
    const spec = getSpecByExt(".py");
    expect(spec).toBeDefined();

    const parser = await createParser();
    const language = await loadLanguage(".py", spec!);
    parser.setLanguage(language);
    const tree = parser.parse(FIXTURE);

    const symbolQuery = language.query(pythonQuerySpec.symbols);
    const names = symbolQuery
      .captures(tree.rootNode)
      .filter((capture) => /^symbol\.[a-z]+\.name$/u.test(capture.name))
      .map((capture) => capture.node.text);

    expect(names).toEqual(["handler", "User", "run"]);

    const importQuery = language.query(pythonQuerySpec.imports);
    const sources = importQuery
      .captures(tree.rootNode)
      .filter((capture) => capture.name === "import.source")
      .map((capture) => capture.node.text);

    expect(sources).toEqual(["os", "fastapi"]);

    symbolQuery.delete();
    importQuery.delete();
    tree.delete();
    parser.delete();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/queries/python.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Write the minimal implementation**

Create `python.ts`:

```ts
import type { LanguageQuerySpec } from "./types";

export const pythonQuerySpec: LanguageQuerySpec = {
  complexity: `
    (if_statement) @complexity.branch
    (elif_clause) @complexity.branch
    (for_statement) @complexity.branch
    (while_statement) @complexity.branch
    (try_statement) @complexity.branch
    (except_clause) @complexity.branch
    (with_statement) @complexity.branch
    (conditional_expression) @complexity.branch
    (boolean_operator operator: "and") @complexity.branch
    (boolean_operator operator: "or") @complexity.branch
  `,
  calls: `
    (call function: (identifier) @call.name) @call.expression
    (call function: (attribute attribute: (identifier) @call.method)) @call.expression
  `,
  detectFramework: (imports) => {
    if (imports.has("fastapi")) {
      return "FastAPI";
    }
    if (imports.has("flask")) {
      return "Flask";
    }
    if (imports.has("django")) {
      return "Django";
    }
    return undefined;
  },
  entrypoints: "",
  exports: "",
  imports: `
    (import_statement name: (dotted_name) @import.source) @import.statement
    (import_from_statement module_name: (dotted_name) @import.source) @import.statement
    (import_from_statement module_name: (relative_import) @import.source) @import.statement
  `,
  isExported: (node, name) =>
    !name.startsWith("_") &&
    (node.parent?.type === "module" || node.parent?.parent?.type === "module"),
  nestingNodeTypes: [
    "function_definition",
    "class_definition",
    "if_statement",
    "for_statement",
    "while_statement",
    "try_statement",
    "with_statement",
    "match_statement",
  ],
  routes: `
    (decorator
      (call
        function: (attribute object: (identifier) @route.receiver attribute: (identifier) @route.method)
        arguments: (argument_list (string (string_content) @route.path)))) @route.call
  `,
  symbols: `
    (function_definition name: (identifier) @symbol.function.name) @symbol.function
    (class_definition name: (identifier) @symbol.class.name) @symbol.class
  `,
};
```

Register `.py` in `queries/index.ts`.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/queries/python.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/modules/analysis/engine/extractors/queries/python.ts \
  apps/web/src/server/modules/analysis/engine/extractors/queries/python.test.ts \
  apps/web/src/server/modules/analysis/engine/extractors/queries/index.ts
git commit -m "feat(web): add python tree-sitter query spec"
```

---

### Task 2.3: Add the Go query spec

**Files:**
- Create: `apps/web/src/server/modules/analysis/engine/extractors/queries/go.ts`
- Modify: `apps/web/src/server/modules/analysis/engine/extractors/queries/index.ts`
- Test: `apps/web/src/server/modules/analysis/engine/extractors/queries/go.test.ts`

**Interfaces:**
- Consumes: `LanguageQuerySpec`
- Produces: `goQuerySpec: LanguageQuerySpec`

- [ ] **Step 1: Write the failing test**

Create `go.test.ts` with the fixture from §1.3 and assert:

```ts
expect(names).toEqual(["main", "User", "Repo", "handler"]);
expect(sources).toEqual(["fmt", "github.com/gin-gonic/gin"]);
```

Use `createParser`, `loadLanguage`, and `language.query(goQuerySpec.symbols)`.

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/queries/go.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Write the minimal implementation**

Create `go.ts`:

```ts
import type { LanguageQuerySpec } from "./types";

export const goQuerySpec: LanguageQuerySpec = {
  complexity: `
    (if_statement) @complexity.branch
    (for_statement) @complexity.branch
    (expression_case) @complexity.branch
    (type_case) @complexity.branch
    (communication_case) @complexity.branch
    (binary_expression operator: "&&") @complexity.branch
    (binary_expression operator: "||") @complexity.branch
  `,
  calls: `
    (call_expression function: (identifier) @call.name) @call.expression
    (call_expression function: (selector_expression field: (field_identifier) @call.method)) @call.expression
  `,
  detectFramework: (imports) => {
    if (imports.has("github.com/gin-gonic/gin")) {
      return "Gin";
    }
    if (imports.has("github.com/labstack/echo/v4")) {
      return "Echo";
    }
    return undefined;
  },
  entrypoints: `
    (function_declaration name: (identifier) @entrypoint.runtime (#eq? @entrypoint.runtime "main")) @entrypoint.call
  `,
  exports: "",
  imports: `
    (import_spec path: (interpreted_string_literal) @import.source) @import.statement
  `,
  isExported: (_node, name) => /^[A-Z]/u.test(name),
  nestingNodeTypes: [
    "function_declaration",
    "method_declaration",
    "if_statement",
    "for_statement",
    "expression_switch_statement",
    "type_switch_statement",
    "select_statement",
  ],
  normalizeRouteMethod: (raw) => raw.toUpperCase(),
  routes: `
    (call_expression
      function: (selector_expression operand: (identifier) @route.receiver field: (field_identifier) @route.method)
      arguments: (argument_list (interpreted_string_literal) @route.path)
      (#match? @route.method "^(GET|POST|PUT|PATCH|DELETE)$")) @route.call
  `,
  symbols: `
    (function_declaration name: (identifier) @symbol.function.name) @symbol.function
    (method_declaration name: (field_identifier) @symbol.method.name) @symbol.method
    (type_declaration (type_spec name: (type_identifier) @symbol.struct.name type: (struct_type))) @symbol.struct
    (type_declaration (type_spec name: (type_identifier) @symbol.interface.name type: (interface_type))) @symbol.interface
  `,
};
```

Register `.go` in `queries/index.ts`.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/queries/go.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/modules/analysis/engine/extractors/queries/go.ts \
  apps/web/src/server/modules/analysis/engine/extractors/queries/go.test.ts \
  apps/web/src/server/modules/analysis/engine/extractors/queries/index.ts
git commit -m "feat(web): add go tree-sitter query spec"
```

---

### Task 2.4: Add the Rust query spec

**Files:**
- Create: `apps/web/src/server/modules/analysis/engine/extractors/queries/rust.ts`
- Modify: `apps/web/src/server/modules/analysis/engine/extractors/queries/index.ts`
- Test: `apps/web/src/server/modules/analysis/engine/extractors/queries/rust.test.ts`

**Interfaces:**
- Consumes: `LanguageQuerySpec`
- Produces: `rustQuerySpec: LanguageQuerySpec`

- [ ] **Step 1: Write the failing test**

Create `rust.test.ts` with the fixture from §1.3 and assert:

```ts
expect(names).toEqual(["User", "Repo", "find", "handler", "main"]);
expect(sources).toEqual(["std::fmt"]);
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/queries/rust.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Write the minimal implementation**

Create `rust.ts`:

```ts
import type { LanguageQuerySpec } from "./types";

export const rustQuerySpec: LanguageQuerySpec = {
  complexity: `
    (if_expression) @complexity.branch
    (for_expression) @complexity.branch
    (while_expression) @complexity.branch
    (loop_expression) @complexity.branch
    (match_arm) @complexity.branch
    (binary_expression operator: "&&") @complexity.branch
    (binary_expression operator: "||") @complexity.branch
  `,
  calls: `
    (call_expression function: (identifier) @call.name) @call.expression
    (call_expression function: (field_expression field: (field_identifier) @call.method)) @call.expression
  `,
  entrypoints: `
    (function_item name: (identifier) @entrypoint.runtime (#eq? @entrypoint.runtime "main")) @entrypoint.call
  `,
  exports: "",
  imports: `
    (use_declaration argument: (scoped_identifier) @import.source) @import.statement
    (use_declaration argument: (identifier) @import.source) @import.statement
  `,
  isExported: (node) => node.children.some((child) => child.type === "visibility_modifier"),
  nestingNodeTypes: [
    "function_item",
    "impl_item",
    "trait_item",
    "if_expression",
    "for_expression",
    "while_expression",
    "loop_expression",
    "match_expression",
  ],
  normalizeRouteMethod: (raw) => raw.toUpperCase(),
  routes: `
    (attribute_item
      (attribute (identifier) @route.method arguments: (token_tree (string_literal) @route.path))
      (#match? @route.method "^(get|post|put|patch|delete)$")) @route.call
  `,
  symbols: `
    (function_item name: (identifier) @symbol.function.name) @symbol.function
    (struct_item name: (type_identifier) @symbol.struct.name) @symbol.struct
    (enum_item name: (type_identifier) @symbol.enum.name) @symbol.enum
    (trait_item name: (type_identifier) @symbol.trait.name) @symbol.trait
    (mod_item name: (identifier) @symbol.module.name) @symbol.module
    (const_item name: (identifier) @symbol.const.name) @symbol.const
    (static_item name: (identifier) @symbol.variable.name) @symbol.variable
  `,
};
```

Register `.rs` in `queries/index.ts`.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/queries/rust.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/modules/analysis/engine/extractors/queries/rust.ts \
  apps/web/src/server/modules/analysis/engine/extractors/queries/rust.test.ts \
  apps/web/src/server/modules/analysis/engine/extractors/queries/index.ts
git commit -m "feat(web): add rust tree-sitter query spec"
```

---

### Task 2.5: Add the Java query spec

**Files:**
- Create: `apps/web/src/server/modules/analysis/engine/extractors/queries/java.ts`
- Modify: `apps/web/src/server/modules/analysis/engine/extractors/queries/index.ts`
- Test: `apps/web/src/server/modules/analysis/engine/extractors/queries/java.test.ts`

**Interfaces:**
- Consumes: `LanguageQuerySpec`
- Produces: `javaQuerySpec: LanguageQuerySpec`

- [ ] **Step 1: Write the failing test**

Create `java.test.ts` with the fixture from §1.3 and assert:

```ts
expect(names).toEqual(["User", "main", "handler"]);
expect(sources).toEqual(["java.util.List"]);
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/queries/java.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Write the minimal implementation**

Create `java.ts`:

```ts
import type { LanguageQuerySpec } from "./types";

export const javaQuerySpec: LanguageQuerySpec = {
  complexity: `
    (if_statement) @complexity.branch
    (for_statement) @complexity.branch
    (enhanced_for_statement) @complexity.branch
    (while_statement) @complexity.branch
    (do_statement) @complexity.branch
    (switch_expression) @complexity.branch
    (catch_clause) @complexity.branch
    (ternary_expression) @complexity.branch
    (binary_expression operator: "&&") @complexity.branch
    (binary_expression operator: "||") @complexity.branch
  `,
  calls: `
    (method_invocation name: (identifier) @call.name) @call.expression
    (method_invocation name: (identifier) @call.method object: (identifier)) @call.expression
    (object_creation_expression type: (type_identifier) @call.constructor) @call.expression
  `,
  entrypoints: `
    (method_declaration name: (identifier) @entrypoint.runtime (#eq? @entrypoint.runtime "main")) @entrypoint.call
  `,
  exports: "",
  imports: `
    (import_declaration (scoped_identifier) @import.source) @import.statement
  `,
  isExported: (node) =>
    node.children.some(
      (child) => child.type === "modifiers" && child.text.includes("public"),
    ),
  nestingNodeTypes: [
    "method_declaration",
    "constructor_declaration",
    "class_declaration",
    "if_statement",
    "for_statement",
    "enhanced_for_statement",
    "while_statement",
    "do_statement",
    "switch_expression",
    "catch_clause",
  ],
  normalizeRouteMethod: (raw) => raw.replace(/Mapping$/iu, "").toUpperCase(),
  routes: `
    (annotation name: (identifier) @route.method arguments: (annotation_argument_list (string_literal) @route.path)) @route.call
  `,
  symbols: `
    (class_declaration name: (identifier) @symbol.class.name) @symbol.class
    (interface_declaration name: (identifier) @symbol.interface.name) @symbol.interface
    (enum_declaration name: (identifier) @symbol.enum.name) @symbol.enum
    (record_declaration name: (identifier) @symbol.class.name) @symbol.class
    (method_declaration name: (identifier) @symbol.method.name) @symbol.method
    (constructor_declaration name: (identifier) @symbol.method.name) @symbol.method
  `,
};
```

Register `.java` in `queries/index.ts`.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/queries/java.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/modules/analysis/engine/extractors/queries/java.ts \
  apps/web/src/server/modules/analysis/engine/extractors/queries/java.test.ts \
  apps/web/src/server/modules/analysis/engine/extractors/queries/index.ts
git commit -m "feat(web): add java tree-sitter query spec"
```

---

### Task 2.6: Add the C# query spec

**Files:**
- Create: `apps/web/src/server/modules/analysis/engine/extractors/queries/csharp.ts`
- Modify: `apps/web/src/server/modules/analysis/engine/extractors/queries/index.ts`
- Test: `apps/web/src/server/modules/analysis/engine/extractors/queries/csharp.test.ts`

**Interfaces:**
- Consumes: `LanguageQuerySpec`
- Produces: `csharpQuerySpec: LanguageQuerySpec`

- [ ] **Step 1: Write the failing test**

Create `csharp.test.ts` with the fixture from §1.3 and assert:

```ts
expect(names).toEqual(["User", "Main", "Handler"]);
expect(sources).toEqual(["System"]);
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/queries/csharp.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Write the minimal implementation**

Create `csharp.ts`:

```ts
import type { LanguageQuerySpec } from "./types";

export const csharpQuerySpec: LanguageQuerySpec = {
  complexity: `
    (if_statement) @complexity.branch
    (for_statement) @complexity.branch
    (foreach_statement) @complexity.branch
    (while_statement) @complexity.branch
    (do_statement) @complexity.branch
    (switch_statement) @complexity.branch
    (catch_clause) @complexity.branch
    (conditional_expression) @complexity.branch
    (binary_expression operator: "&&") @complexity.branch
    (binary_expression operator: "||") @complexity.branch
  `,
  calls: `
    (invocation_expression function: (identifier) @call.name) @call.expression
    (invocation_expression function: (member_access_expression name: (identifier) @call.method)) @call.expression
    (object_creation_expression type: (identifier) @call.constructor) @call.expression
  `,
  entrypoints: `
    (method_declaration name: (identifier) @entrypoint.runtime (#eq? @entrypoint.runtime "Main")) @entrypoint.call
  `,
  exports: "",
  imports: `
    (using_directive (identifier) @import.source) @import.statement
    (using_directive (qualified_name) @import.source) @import.statement
  `,
  isExported: (node) =>
    node.children.some((child) => child.type === "modifier" && child.text === "public"),
  nestingNodeTypes: [
    "method_declaration",
    "constructor_declaration",
    "class_declaration",
    "if_statement",
    "for_statement",
    "foreach_statement",
    "while_statement",
    "do_statement",
    "switch_statement",
    "catch_clause",
  ],
  normalizeRouteMethod: (raw) => raw.replace(/^Http/iu, "").toUpperCase(),
  routes: `
    (attribute name: (identifier) @route.method arguments: (attribute_argument_list (attribute_argument (string_literal) @route.path))) @route.call
  `,
  symbols: `
    (class_declaration name: (identifier) @symbol.class.name) @symbol.class
    (interface_declaration name: (identifier) @symbol.interface.name) @symbol.interface
    (struct_declaration name: (identifier) @symbol.struct.name) @symbol.struct
    (enum_declaration name: (identifier) @symbol.enum.name) @symbol.enum
    (record_declaration name: (identifier) @symbol.class.name) @symbol.class
    (method_declaration name: (identifier) @symbol.method.name) @symbol.method
  `,
};
```

Register `.cs` in `queries/index.ts`.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/queries/csharp.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/modules/analysis/engine/extractors/queries/csharp.ts \
  apps/web/src/server/modules/analysis/engine/extractors/queries/csharp.test.ts \
  apps/web/src/server/modules/analysis/engine/extractors/queries/index.ts
git commit -m "feat(web): add csharp tree-sitter query spec"
```

---

### Task 2.7: Add the PHP query spec

**Files:**
- Create: `apps/web/src/server/modules/analysis/engine/extractors/queries/php.ts`
- Modify: `apps/web/src/server/modules/analysis/engine/extractors/queries/index.ts`
- Test: `apps/web/src/server/modules/analysis/engine/extractors/queries/php.test.ts`

**Interfaces:**
- Consumes: `LanguageQuerySpec`
- Produces: `phpQuerySpec: LanguageQuerySpec`

- [ ] **Step 1: Write the failing test**

Create `php.test.ts` with the fixture from §1.3 and assert:

```ts
expect(names).toEqual(["User", "run"]);
expect(sources).toEqual(["Foo\\Bar", "x.php"]);
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/queries/php.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Write the minimal implementation**

Create `php.ts`:

```ts
import type { LanguageQuerySpec } from "./types";

export const phpQuerySpec: LanguageQuerySpec = {
  complexity: `
    (if_statement) @complexity.branch
    (for_statement) @complexity.branch
    (foreach_statement) @complexity.branch
    (while_statement) @complexity.branch
    (do_statement) @complexity.branch
    (switch_statement) @complexity.branch
    (catch_clause) @complexity.branch
    (conditional_expression) @complexity.branch
    (binary_expression operator: "&&") @complexity.branch
    (binary_expression operator: "||") @complexity.branch
  `,
  calls: `
    (function_call_expression function: (name) @call.name) @call.expression
    (member_call_expression name: (name) @call.method) @call.expression
    (object_creation_expression) @call.expression
  `,
  entrypoints: "",
  exports: "",
  imports: `
    (namespace_use_declaration (namespace_use_clause (qualified_name) @import.source)) @import.statement
    (require_expression (encapsed_string (string_content) @import.source)) @import.statement
    (include_expression (encapsed_string (string_content) @import.source)) @import.statement
  `,
  isExported: (node) =>
    node.children.some(
      (child) => child.type === "visibility_modifier" && child.text === "public",
    ),
  nestingNodeTypes: [
    "method_declaration",
    "function_definition",
    "class_declaration",
    "if_statement",
    "for_statement",
    "foreach_statement",
    "while_statement",
    "do_statement",
    "switch_statement",
    "catch_clause",
  ],
  normalizeRouteMethod: (raw) => raw.toUpperCase(),
  routes: `
    (scoped_call_expression
      scope: (name) @route.receiver
      name: (name) @route.method
      arguments: (arguments (argument (encapsed_string (string_content) @route.path)))) @route.call
  `,
  symbols: `
    (class_declaration name: (name) @symbol.class.name) @symbol.class
    (interface_declaration name: (name) @symbol.interface.name) @symbol.interface
    (trait_declaration name: (name) @symbol.trait.name) @symbol.trait
    (function_definition name: (name) @symbol.function.name) @symbol.function
    (method_declaration name: (name) @symbol.method.name) @symbol.method
  `,
};
```

Register `.php` in `queries/index.ts`.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/queries/php.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/modules/analysis/engine/extractors/queries/php.ts \
  apps/web/src/server/modules/analysis/engine/extractors/queries/php.test.ts \
  apps/web/src/server/modules/analysis/engine/extractors/queries/index.ts
git commit -m "feat(web): add php tree-sitter query spec"
```

---

### Task 2.8: Add the C and C++ query specs

**Files:**
- Create: `apps/web/src/server/modules/analysis/engine/extractors/queries/c.ts`
- Create: `apps/web/src/server/modules/analysis/engine/extractors/queries/cpp.ts`
- Modify: `apps/web/src/server/modules/analysis/engine/extractors/queries/index.ts`
- Test: `apps/web/src/server/modules/analysis/engine/extractors/queries/c-family.test.ts`

**Interfaces:**
- Consumes: `LanguageQuerySpec`
- Produces: `cQuerySpec`, `cppQuerySpec`

- [ ] **Step 1: Write the failing test**

Create `c-family.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { createParser, getSpecByExt, loadLanguage } from "@/server/core/tree-sitter";

import { cQuerySpec } from "./c";
import { cppQuerySpec } from "./cpp";

const C_FIXTURE = [
  "#include <stdio.h>",
  "int main(void) { return 0; }",
  "struct User { int id; };",
].join("\n");

const CPP_FIXTURE = [
  "#include <iostream>",
  "namespace X { class User { public: int run(int a) { return a; } }; }",
  "int main() { return 0; }",
].join("\n");

describe("c-family query specs", () => {
  it("captures C functions, structs and includes", async () => {
    const spec = getSpecByExt(".c");
    expect(spec).toBeDefined();

    const parser = await createParser();
    const language = await loadLanguage(".c", spec!);
    parser.setLanguage(language);
    const tree = parser.parse(C_FIXTURE);

    const names = language
      .query(cQuerySpec.symbols)
      .captures(tree.rootNode)
      .filter((capture) => /^symbol\.[a-z]+\.name$/u.test(capture.name))
      .map((capture) => capture.node.text);

    const sources = language
      .query(cQuerySpec.imports)
      .captures(tree.rootNode)
      .filter((capture) => capture.name === "import.source")
      .map((capture) => capture.node.text);

    expect(names).toEqual(["main", "User"]);
    expect(sources).toEqual(["<stdio.h>"]);

    tree.delete();
    parser.delete();
  });

  it("captures C++ namespaces, classes, methods and includes", async () => {
    const spec = getSpecByExt(".cpp");
    expect(spec).toBeDefined();

    const parser = await createParser();
    const language = await loadLanguage(".cpp", spec!);
    parser.setLanguage(language);
    const tree = parser.parse(CPP_FIXTURE);

    const names = language
      .query(cppQuerySpec.symbols)
      .captures(tree.rootNode)
      .filter((capture) => /^symbol\.[a-z]+\.name$/u.test(capture.name))
      .map((capture) => capture.node.text);

    expect(names).toEqual(["X", "User", "run", "main"]);

    tree.delete();
    parser.delete();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/queries/c-family.test.ts
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Write the minimal implementation**

Create `c.ts`:

```ts
import type { LanguageQuerySpec } from "./types";

export const cQuerySpec: LanguageQuerySpec = {
  complexity: `
    (if_statement) @complexity.branch
    (for_statement) @complexity.branch
    (while_statement) @complexity.branch
    (do_statement) @complexity.branch
    (switch_statement) @complexity.branch
    (case_statement) @complexity.branch
    (conditional_expression) @complexity.branch
    (binary_expression operator: "&&") @complexity.branch
    (binary_expression operator: "||") @complexity.branch
  `,
  calls: `
    (call_expression function: (identifier) @call.name) @call.expression
  `,
  entrypoints: "",
  exports: "",
  imports: `
    (preproc_include path: (system_lib_string) @import.source) @import.statement
    (preproc_include path: (string_literal) @import.source) @import.statement
  `,
  isExported: (node) => !node.text.startsWith("static "),
  nestingNodeTypes: [
    "function_definition",
    "if_statement",
    "for_statement",
    "while_statement",
    "do_statement",
    "switch_statement",
  ],
  routes: "",
  symbols: `
    (function_definition declarator: (function_declarator declarator: (identifier) @symbol.function.name)) @symbol.function
    (struct_specifier name: (type_identifier) @symbol.struct.name) @symbol.struct
    (enum_specifier name: (type_identifier) @symbol.enum.name) @symbol.enum
  `,
};
```

Create `cpp.ts`:

```ts
import type { LanguageQuerySpec } from "./types";

export const cppQuerySpec: LanguageQuerySpec = {
  complexity: `
    (if_statement) @complexity.branch
    (for_statement) @complexity.branch
    (while_statement) @complexity.branch
    (do_statement) @complexity.branch
    (switch_statement) @complexity.branch
    (case_statement) @complexity.branch
    (conditional_expression) @complexity.branch
    (binary_expression operator: "&&") @complexity.branch
    (binary_expression operator: "||") @complexity.branch
  `,
  calls: `
    (call_expression function: (identifier) @call.name) @call.expression
    (call_expression function: (field_expression field: (field_identifier) @call.method)) @call.expression
  `,
  entrypoints: "",
  exports: "",
  imports: `
    (preproc_include path: (system_lib_string) @import.source) @import.statement
    (preproc_include path: (string_literal) @import.source) @import.statement
  `,
  isExported: (node) => !node.text.startsWith("static "),
  nestingNodeTypes: [
    "function_definition",
    "class_specifier",
    "namespace_definition",
    "if_statement",
    "for_statement",
    "while_statement",
    "do_statement",
    "switch_statement",
  ],
  routes: "",
  symbols: `
    (function_definition declarator: (function_declarator declarator: (identifier) @symbol.function.name)) @symbol.function
    (function_definition declarator: (function_declarator declarator: (field_identifier) @symbol.method.name)) @symbol.method
    (struct_specifier name: (type_identifier) @symbol.struct.name) @symbol.struct
    (class_specifier name: (type_identifier) @symbol.class.name) @symbol.class
    (enum_specifier name: (type_identifier) @symbol.enum.name) @symbol.enum
    (namespace_definition name: (namespace_identifier) @symbol.module.name) @symbol.module
  `,
};
```

Register `.c` and `.cpp` in `queries/index.ts`.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/queries/c-family.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/modules/analysis/engine/extractors/queries/c.ts \
  apps/web/src/server/modules/analysis/engine/extractors/queries/cpp.ts \
  apps/web/src/server/modules/analysis/engine/extractors/queries/c-family.test.ts \
  apps/web/src/server/modules/analysis/engine/extractors/queries/index.ts
git commit -m "feat(web): add c and cpp tree-sitter query specs"
```

---

### Task 2.9: Add the Bash, Lua, Objective-C and Swift query specs

**Files:**
- Create: `apps/web/src/server/modules/analysis/engine/extractors/queries/bash.ts`
- Create: `apps/web/src/server/modules/analysis/engine/extractors/queries/lua.ts`
- Create: `apps/web/src/server/modules/analysis/engine/extractors/queries/objc.ts`
- Create: `apps/web/src/server/modules/analysis/engine/extractors/queries/swift.ts`
- Modify: `apps/web/src/server/modules/analysis/engine/extractors/queries/index.ts`
- Test: `apps/web/src/server/modules/analysis/engine/extractors/queries/remaining.test.ts`

**Interfaces:**
- Consumes: `LanguageQuerySpec`
- Produces: `bashQuerySpec`, `luaQuerySpec`, `objcQuerySpec`, `swiftQuerySpec`

- [ ] **Step 1: Write the failing test**

Create `remaining.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { createParser, getSpecByExt, loadLanguage } from "@/server/core/tree-sitter";

import { bashQuerySpec } from "./bash";
import { luaQuerySpec } from "./lua";
import { objcQuerySpec } from "./objc";
import { swiftQuerySpec } from "./swift";

async function namesFor(ext: string, spec: Parameters<typeof loadLanguage>[1], querySource: string, content: string) {
  const parser = await createParser();
  const language = await loadLanguage(ext, spec);
  parser.setLanguage(language);
  const tree = parser.parse(content);
  const names = language
    .query(querySource)
    .captures(tree.rootNode)
    .filter((capture) => /^symbol\.[a-z]+\.name$/u.test(capture.name))
    .map((capture) => capture.node.text);
  tree.delete();
  parser.delete();
  return names;
}

describe("remaining query specs", () => {
  it("captures bash functions and source commands", async () => {
    const spec = getSpecByExt(".sh");
    expect(spec).toBeDefined();
    expect(await namesFor(".sh", spec!, bashQuerySpec.symbols, "f() { echo x; }\n")).toEqual(["f"]);
  });

  it("captures lua local and module functions", async () => {
    const spec = getSpecByExt(".lua");
    expect(spec).toBeDefined();
    expect(
      await namesFor(".lua", spec!, luaQuerySpec.symbols, "local function f() end\nfunction M.g() end\n"),
    ).toEqual(["f", "g"]);
  });

  it("captures objc classes and methods", async () => {
    const spec = getSpecByExt(".m");
    expect(spec).toBeDefined();
    expect(
      await namesFor(
        ".m",
        spec!,
        objcQuerySpec.symbols,
        "@interface User : NSObject\n- (void)run:(int)a;\n@end\n",
      ),
    ).toEqual(["User", "run"]);
  });

  it("captures swift functions and classes", async () => {
    const spec = getSpecByExt(".swift");
    expect(spec).toBeDefined();
    expect(
      await namesFor(
        ".swift",
        spec!,
        swiftQuerySpec.symbols,
        "func greet() {}\nclass User { func run() {} }\n",
      ),
    ).toEqual(["greet", "User", "run"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/queries/remaining.test.ts
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Write the minimal implementation**

Create `bash.ts`:

```ts
import type { LanguageQuerySpec } from "./types";

export const bashQuerySpec: LanguageQuerySpec = {
  complexity: `
    (if_statement) @complexity.branch
    (for_statement) @complexity.branch
    (while_statement) @complexity.branch
    (case_statement) @complexity.branch
  `,
  calls: `(command name: (command_name (word) @call.name)) @call.expression`,
  entrypoints: "",
  exports: "",
  imports: `
    (command name: (command_name (word) @import.command) (#match? @import.command "^(source|\\.)$") argument: (word) @import.source) @import.statement
  `,
  isExported: () => true,
  nestingNodeTypes: [
    "function_definition",
    "if_statement",
    "for_statement",
    "while_statement",
    "case_statement",
  ],
  routes: "",
  symbols: `(function_definition name: (word) @symbol.function.name) @symbol.function`,
};
```

Create `lua.ts`:

```ts
import type { LanguageQuerySpec } from "./types";

export const luaQuerySpec: LanguageQuerySpec = {
  complexity: `
    (if_statement) @complexity.branch
    (for_statement) @complexity.branch
    (while_statement) @complexity.branch
    (repeat_statement) @complexity.branch
  `,
  calls: `(function_call name: (identifier) @call.name) @call.expression`,
  entrypoints: "",
  exports: "",
  imports: `
    (function_call name: (identifier) @import.require (#eq? @import.require "require") arguments: (arguments (string (string_content) @import.source))) @import.statement
  `,
  isExported: () => true,
  nestingNodeTypes: [
    "function_declaration",
    "function_definition",
    "local_function_definition_statement",
    "function_definition_statement",
    "if_statement",
    "for_statement",
    "while_statement",
    "repeat_statement",
  ],
  routes: "",
  symbols: `
    (local_function_definition_statement name: (identifier) @symbol.function.name) @symbol.function
    (function_definition_statement name: (identifier) @symbol.function.name) @symbol.function
    (function_definition_statement name: (variable table: (identifier) field: (identifier) @symbol.method.name)) @symbol.method
  `,
};
```

Create `objc.ts`:

```ts
import type { LanguageQuerySpec } from "./types";

export const objcQuerySpec: LanguageQuerySpec = {
  complexity: `
    (if_statement) @complexity.branch
    (for_statement) @complexity.branch
    (while_statement) @complexity.branch
    (do_statement) @complexity.branch
    (switch_statement) @complexity.branch
  `,
  calls: `(call_expression function: (identifier) @call.name) @call.expression`,
  entrypoints: "",
  exports: "",
  imports: `
    (preproc_include path: (system_lib_string) @import.source) @import.statement
    (preproc_include path: (string_literal) @import.source) @import.statement
  `,
  isExported: () => true,
  nestingNodeTypes: [
    "method_definition",
    "function_definition",
    "if_statement",
    "for_statement",
    "while_statement",
    "switch_statement",
  ],
  routes: "",
  symbols: `
    (class_interface (identifier) @symbol.class.name) @symbol.class
    (class_implementation (identifier) @symbol.class.name) @symbol.class
    (method_definition (identifier) @symbol.method.name) @symbol.method
    (method_declaration (identifier) @symbol.method.name) @symbol.method
  `,
};
```

Create `swift.ts`:

```ts
import type { LanguageQuerySpec } from "./types";

export const swiftQuerySpec: LanguageQuerySpec = {
  complexity: `
    (if_statement) @complexity.branch
    (for_statement) @complexity.branch
    (while_statement) @complexity.branch
    (repeat_while_statement) @complexity.branch
    (switch_statement) @complexity.branch
    (catch_clause) @complexity.branch
  `,
  calls: `(call_expression (simple_identifier) @call.name) @call.expression`,
  entrypoints: "",
  exports: "",
  imports: `(import_declaration (identifier) @import.source) @import.statement`,
  isExported: (node) => node.text.includes("public ") || node.text.includes("open "),
  nestingNodeTypes: [
    "function_declaration",
    "class_declaration",
    "if_statement",
    "for_statement",
    "while_statement",
    "repeat_while_statement",
    "switch_statement",
    "catch_clause",
  ],
  routes: "",
  symbols: `
    (function_declaration name: (simple_identifier) @symbol.function.name) @symbol.function
    (class_declaration name: (type_identifier) @symbol.class.name) @symbol.class
    (protocol_declaration name: (type_identifier) @symbol.interface.name) @symbol.interface
    (enum_declaration name: (type_identifier) @symbol.enum.name) @symbol.enum
  `,
};
```

Register `.sh`, `.lua`, `.m`, `.swift` in `queries/index.ts`.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/queries/remaining.test.ts
```

Expected: PASS. If a capture name is wrong, inspect `tree.rootNode.toString()` for that language and adjust the query; do not change the collector.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/modules/analysis/engine/extractors/queries/bash.ts \
  apps/web/src/server/modules/analysis/engine/extractors/queries/lua.ts \
  apps/web/src/server/modules/analysis/engine/extractors/queries/objc.ts \
  apps/web/src/server/modules/analysis/engine/extractors/queries/swift.ts \
  apps/web/src/server/modules/analysis/engine/extractors/queries/remaining.test.ts \
  apps/web/src/server/modules/analysis/engine/extractors/queries/index.ts
git commit -m "feat(web): add remaining tree-sitter query specs"
```

---

### Task 2.10: Delete the legacy walker and update coverage

**Files:**
- Modify: `apps/web/src/server/modules/analysis/engine/extractors/tree-sitter-signals.ts`
- Modify: `apps/web/src/server/modules/analysis/engine/metrics/code-metric-scan.ts`
- Test: `apps/web/src/server/modules/analysis/engine/extractors/tree-sitter-signals.test.ts`

**Interfaces:**
- Consumes: `QUERY_SPECS`
- Produces: every extension in `TREE_SITTER_SUPPORTED_EXTENSIONS` has a query spec; `collectLegacySignals` is removed; `analysisCoverage` reports `tree-sitter` for every supported file.

- [ ] **Step 1: Write the failing test**

Append:

```ts
it("has a query spec for every advertised tree-sitter extension", () => {
  const missing = TREE_SITTER_SUPPORTED_EXTENSIONS.filter((ext) => QUERY_SPECS[ext] == null);
  expect(missing).toEqual([]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/tree-sitter-signals.test.ts
```

Expected: FAIL with the list of extensions that still lack a query spec.

- [ ] **Step 3: Write the minimal implementation**

- Add the missing specs from Tasks 2.2–2.9 to `QUERY_SPECS`.
- Remove `collectLegacySignals`, `collectRoutes`, `extractNodeName`, and the `TS_ROUTE_PATTERNS` import path from `tree-sitter-signals.ts`.
- Keep `collectTreeSitterSignals` as the dispatcher:

```ts
export async function collectTreeSitterSignals(
  file: RepositoryFile,
): Promise<FileSignals | null> {
  const ext = getFileExtension(file.path);
  const spec = getSpecByExt(ext);
  const querySpec = QUERY_SPECS[ext];
  if (spec == null || querySpec == null) {
    return null;
  }

  try {
    return await collectQuerySignals(file, ext, querySpec);
  } catch (error) {
    appLogger.error({ error, ext, msg: "Tree-sitter query extraction failed", path: file.path });
    return null;
  }
}
```

- In `code-metric-scan.ts`, remove the `typescript-ast` branch or leave it unreachable but documented. The simplest truthful change is to keep the branch (future) but do not count it as zero coverage. Add a comment only if necessary; the branch is dead but harmless. Do not report `typeScriptAstFiles` as anything other than 0 until a real compiler adapter exists.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/tree-sitter-signals.test.ts \
  src/server/modules/analysis/engine/metrics/code-metric-scan.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/modules/analysis/engine/extractors/tree-sitter-signals.ts \
  apps/web/src/server/modules/analysis/engine/extractors/tree-sitter-signals.test.ts \
  apps/web/src/server/modules/analysis/engine/metrics/code-metric-scan.ts
git commit -m "refactor(web): remove legacy tree-sitter walker"
```

---

## Milestone 3 — Symbol index and call graph

### Task 3.1: Build the symbol index

**Files:**
- Create: `apps/web/src/server/modules/analysis/engine/core/symbol-index.ts`
- Create: `apps/web/src/server/modules/analysis/engine/core/symbol-index.test.ts`

**Interfaces:**
- Consumes: `ModuleRef[]`
- Produces:
  - `SymbolIndex = { byPath: Map<string, Map<string, SymbolRef>>; exportedByPath: Map<string, Map<string, SymbolRef>> }`
  - `buildSymbolIndex(modules: ModuleRef[]): SymbolIndex`
  - `resolveExportedSymbol(index: SymbolIndex, targetPath: string, name: string): SymbolRef | null`

- [ ] **Step 1: Write the failing test**

Create `symbol-index.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { ModuleRef } from "./discovery.types";
import { buildSymbolIndex, resolveExportedSymbol } from "./symbol-index";

const moduleRef = (path: string, symbols: ModuleRef["symbols"]): ModuleRef => ({
  apiSurface: 0,
  categories: [],
  entrypointHints: [],
  exports: symbols.filter((symbol) => symbol.exported).length,
  frameworkHints: [],
  imports: [],
  parseTier: "tree-sitter",
  path,
  routeCount: 0,
  symbols,
});

describe("buildSymbolIndex", () => {
  it("indexes all symbols and exported symbols separately", () => {
    const index = buildSymbolIndex([
      moduleRef("src/b.ts", [
        { confidence: 78, exported: true, kind: "function", name: "foo", path: "src/b.ts" },
        { confidence: 78, exported: false, kind: "function", name: "bar", path: "src/b.ts" },
      ]),
    ]);

    expect(index.byPath.get("src/b.ts")?.get("foo")?.name).toBe("foo");
    expect(index.exportedByPath.get("src/b.ts")?.has("bar")).toBe(false);
    expect(resolveExportedSymbol(index, "src/b.ts", "foo")?.name).toBe("foo");
    expect(resolveExportedSymbol(index, "src/b.ts", "bar")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/core/symbol-index.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Write the minimal implementation**

Create `symbol-index.ts`:

```ts
import type { ModuleRef, SymbolRef } from "./discovery.types";

export type SymbolIndex = {
  byPath: Map<string, Map<string, SymbolRef>>;
  exportedByPath: Map<string, Map<string, SymbolRef>>;
};

export function buildSymbolIndex(modules: ModuleRef[]): SymbolIndex {
  const byPath = new Map<string, Map<string, SymbolRef>>();
  const exportedByPath = new Map<string, Map<string, SymbolRef>>();

  for (const module of modules) {
    const all = new Map<string, SymbolRef>();
    const exported = new Map<string, SymbolRef>();

    for (const symbol of module.symbols) {
      all.set(symbol.name, symbol);
      if (symbol.exported) {
        exported.set(symbol.name, symbol);
      }
    }

    byPath.set(module.path, all);
    exportedByPath.set(module.path, exported);
  }

  return { byPath, exportedByPath };
}

export function resolveExportedSymbol(
  index: SymbolIndex,
  targetPath: string,
  name: string,
): SymbolRef | null {
  return index.exportedByPath.get(targetPath)?.get(name) ?? null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/core/symbol-index.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/modules/analysis/engine/core/symbol-index.ts \
  apps/web/src/server/modules/analysis/engine/core/symbol-index.test.ts
git commit -m "feat(web): add symbol index"
```

---

### Task 3.2: Extract intra-file call sites

**Files:**
- Create: `apps/web/src/server/modules/analysis/engine/core/call-graph.ts`
- Create: `apps/web/src/server/modules/analysis/engine/core/call-graph.test.ts`
- Modify: `apps/web/src/server/modules/analysis/engine/extractors/query-signals.ts`

**Interfaces:**
- Consumes: `LanguageQuerySpec.calls`, `FileSignals`
- Produces:
  - `CallSite = { calleeName: string; callerName: string | null; line: number; path: string; receiver?: string }`
  - `FileSignals.calls?: CallSite[]`
  - `extractCallSites(file, ext, querySpec): Promise<CallSite[]>`

- [ ] **Step 1: Write the failing test**

Create `call-graph.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { extractCallSites } from "./call-graph";
import { typescriptQuerySpec } from "../extractors/queries/typescript";

describe("extractCallSites", () => {
  it("attributes calls to their enclosing function", async () => {
    const sites = await extractCallSites(
      {
        content: [
          "function a() { b(); obj.c(); }",
          "function b() {}",
        ].join("\n"),
        path: "src/calls.ts",
      },
      ".ts",
      typescriptQuerySpec,
    );

    expect(sites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ calleeName: "b", callerName: "a", line: 1 }),
        expect.objectContaining({ calleeName: "c", callerName: "a", line: 1, receiver: "obj" }),
      ]),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/core/call-graph.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Write the minimal implementation**

Create `call-graph.ts`:

```ts
import type Parser from "web-tree-sitter";

import { getParserForExt, getSpecByExt, loadLanguage } from "@/server/core/tree-sitter";
import { compileQuery } from "@/server/core/tree-sitter/query-cache";

import type { CallSite, RepositoryFile } from "./discovery.types";
import { capturesByName, firstCapture } from "../extractors/queries/captures";
import type { LanguageQuerySpec } from "../extractors/queries/types";

export type { CallSite };

const FUNCTION_NODE_TYPES = new Set([
  "arrow_function",
  "function_declaration",
  "function_definition",
  "function_definition_statement",
  "function_item",
  "local_function_definition_statement",
  "method_declaration",
  "method_definition",
]);

function findEnclosingFunction(node: Parser.SyntaxNode): string | null {
  let current: Parser.SyntaxNode | null = node.parent;

  while (current != null) {
    if (FUNCTION_NODE_TYPES.has(current.type)) {
      return current.childForFieldName("name")?.text ?? null;
    }
    current = current.parent;
  }

  return null;
}

export async function extractCallSites(
  file: RepositoryFile,
  ext: string,
  querySpec: LanguageQuerySpec,
): Promise<CallSite[]> {
  if (querySpec.calls == null || querySpec.calls.trim().length === 0) {
    return [];
  }

  const spec = getSpecByExt(ext);
  if (spec == null) {
    return [];
  }

  let tree: Parser.Tree | undefined;

  try {
    const parser = await getParserForExt(ext);
    const language = await loadLanguage(ext, spec);
    parser.setLanguage(language);
    tree = parser.parse(file.content);

    const query = await compileQuery(ext, spec, querySpec.calls);
    const sites: CallSite[] = [];

    for (const match of query.matches(tree.rootNode)) {
      const captures = capturesByName(match.captures);
      const expression = firstCapture(captures, "call.expression");
      const callee =
        firstCapture(captures, "call.name") ??
        firstCapture(captures, "call.method") ??
        firstCapture(captures, "call.constructor");
      if (expression == null || callee == null) {
        continue;
      }

      sites.push({
        calleeName: callee.text,
        callerName: findEnclosingFunction(expression),
        line: expression.startPosition.row + 1,
        path: file.path,
        receiver: firstCapture(captures, "call.object")?.text,
      });
    }

    return sites;
  } finally {
    tree?.delete();
  }
}
```

Add `CallSite` to `discovery.types.ts`:

```ts
export type CallSite = {
  calleeName: string;
  callerName: string | null;
  line: number;
  path: string;
  receiver?: string;
};
```

Add to `FileSignals`:

```ts
calls?: CallSite[];
```

For every language `calls` query, capture the receiver as `@call.object` when the grammar exposes it (for example `(member_expression object: (identifier) @call.object ...)`). `extractCallSites` uses that capture to mark method calls as unresolved instead of guessing a free-function call.

In `query-signals.ts`, after building the signals, optionally populate calls:

```ts
const calls = querySpec.calls == null ? [] : await extractCallSites(file, ext, querySpec);
```

Then include `calls` in the returned object.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/core/call-graph.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/modules/analysis/engine/core/call-graph.ts \
  apps/web/src/server/modules/analysis/engine/core/call-graph.test.ts \
  apps/web/src/server/modules/analysis/engine/core/discovery.types.ts \
  apps/web/src/server/modules/analysis/engine/extractors/query-signals.ts
git commit -m "feat(web): extract intra-file call sites"
```

---

### Task 3.3: Resolve cross-file call edges

**Files:**
- Modify: `apps/web/src/server/modules/analysis/engine/core/call-graph.ts`
- Test: `apps/web/src/server/modules/analysis/engine/core/call-graph.test.ts`

**Interfaces:**
- Consumes: `CallSite[]`, `ImportRef[]`, `SymbolIndex`, `resolveImport`
- Produces:
  - `ResolvedCallEdge = CallSite & { resolved: boolean; targetPath?: string }`
  - `resolveCallSites(sites, importDetailsByPath, index, resolveImport): ResolvedCallEdge[]`

- [ ] **Step 1: Write the failing test**

Append:

```ts
it("resolves a call through a named import", () => {
  const index = buildSymbolIndex([
    moduleRef("src/b.ts", [
      { confidence: 78, exported: true, kind: "function", name: "foo", path: "src/b.ts" },
    ]),
  ]);

  const edges = resolveCallSites(
    [{ calleeName: "foo", callerName: "main", line: 3, path: "src/a.ts" }],
    new Map([
      [
        "src/a.ts",
        [
          {
            kind: "named",
            names: ["foo"],
            source: "./b",
          },
        ],
      ],
    ]),
    index,
    (_fromPath, specifier) => (specifier === "./b" ? "src/b.ts" : null),
  );

  expect(edges).toEqual([
    expect.objectContaining({ calleeName: "foo", resolved: true, targetPath: "src/b.ts" }),
  ]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/core/call-graph.test.ts
```

Expected: FAIL because `resolveCallSites` does not exist.

- [ ] **Step 3: Write the minimal implementation**

Add `ResolvedCallEdge` to `discovery.types.ts`:

```ts
export type ResolvedCallEdge = CallSite & {
  resolved: boolean;
  targetPath?: string;
};
```

Append to `call-graph.ts`:

```ts
import type { ImportRef, ResolvedCallEdge } from "./discovery.types";
import { resolveExportedSymbol, type SymbolIndex } from "./symbol-index";

export type { ResolvedCallEdge };

export function resolveCallSites(
  sites: CallSite[],
  importDetailsByPath: Map<string, ImportRef[]>,
  index: SymbolIndex,
  resolveImport: (fromPath: string, specifier: string) => string | null,
): ResolvedCallEdge[] {
  return sites.map((site) => {
    if (site.receiver != null) {
      return { ...site, resolved: false };
    }

    const imports = importDetailsByPath.get(site.path) ?? [];

    for (const detail of imports) {
      if (detail.kind === "side-effect" || detail.kind === "require") {
        continue;
      }

      const names = detail.names ?? [];
      const matchesImport =
        detail.kind === "default" ||
        detail.kind === "namespace" ||
        names.includes(site.calleeName);

      if (!matchesImport) {
        continue;
      }

      const targetPath = resolveImport(site.path, detail.source);
      if (targetPath == null) {
        continue;
      }

      const symbol = resolveExportedSymbol(index, targetPath, site.calleeName);
      if (symbol != null) {
        return { ...site, resolved: true, targetPath };
      }
    }

    return { ...site, resolved: false };
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/core/call-graph.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/modules/analysis/engine/core/call-graph.ts \
  apps/web/src/server/modules/analysis/engine/core/call-graph.test.ts
git commit -m "feat(web): resolve cross-file call edges"
```

---

### Task 3.4: Wire call edges into repository evidence

**Files:**
- Modify: `apps/web/src/server/modules/analysis/engine/core/discovery.types.ts`
- Modify: `apps/web/src/server/modules/analysis/engine/core/evidence.ts`
- Test: `apps/web/src/server/modules/analysis/engine/core/evidence.test.ts`

**Interfaces:**
- Consumes: `FileSignals.calls`, `buildSymbolIndex`, `resolveCallSites`
- Produces: `RepositoryEvidence.calls?: ResolvedCallEdge[]`

- [ ] **Step 1: Write the failing test**

Append to `evidence.test.ts`:

```ts
it("aggregates call edges from file signals", async () => {
  const evidence = await collectRepositoryEvidence(
    [
      { content: 'import { foo } from "./b"; function main() { foo(); }', path: "src/a.ts" },
      { content: "export function foo() {}", path: "src/b.ts" },
    ],
    [],
    new Map([
      [
        "src/a.ts",
        {
          analysisMode: "tree-sitter",
          apiSurface: 0,
          complexityMetrics: { complexity: 0, maxNesting: 0 },
          confidence: 80,
          entrypointHint: false,
          exports: 0,
          calls: [{ calleeName: "foo", callerName: "main", line: 1, path: "src/a.ts" }],
          importDetails: [{ kind: "named", names: ["foo"], source: "./b" }],
          imports: ["./b"],
          path: "src/a.ts",
          source: "extraction",
          symbols: [],
        },
      ],
      [
        "src/b.ts",
        {
          analysisMode: "tree-sitter",
          apiSurface: 0,
          complexityMetrics: { complexity: 0, maxNesting: 0 },
          confidence: 80,
          entrypointHint: false,
          exports: 1,
          imports: [],
          path: "src/b.ts",
          source: "extraction",
          symbols: [
            { confidence: 78, exported: true, kind: "function", name: "foo", path: "src/b.ts" },
          ],
        },
      ],
    ]),
  );

  expect(evidence.calls).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ calleeName: "foo", resolved: true, targetPath: "src/b.ts" }),
    ]),
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/core/evidence.test.ts
```

Expected: FAIL because `evidence.calls` is `undefined`.

- [ ] **Step 3: Write the minimal implementation**

Add to `RepositoryEvidence`:

```ts
calls?: ResolvedCallEdge[];
```

`ResolvedCallEdge` is already defined in `discovery.types.ts` by Task 3.3; do not import it from `call-graph.ts`.

In `collectRepositoryEvidence`, after `moduleByPath` is built:

```ts
const symbolIndex = buildSymbolIndex(assembly.modules);
const callSites = assembly.modules.flatMap((module) => module.calls ?? []);
const importDetailsByPath = new Map(
  lookups.normalizedFiles.map((file) => [
    file.path,
    fileSignalsByPath.get(file.path)?.importDetails ?? [],
  ]),
);
const calls = resolveCallSites(callSites, importDetailsByPath, symbolIndex, (fromPath, specifier) =>
  resolveRelativeImport(fromPath, specifier, lookups.fileSet) ??
  resolveModuleImport(specifier, lookups.fileSet, lookups.filesByBaseName, lookups.aliasRules),
);
```

Then include `calls` in the returned `evidence`.

Add `calls?: CallSite[]` to `ModuleRef` (or rely on `FileSignals`; `buildModuleRef` must copy it):

```ts
calls: signals.calls,
```

in `buildModuleRef`.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/core/evidence.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/modules/analysis/engine/core/discovery.types.ts \
  apps/web/src/server/modules/analysis/engine/core/evidence.ts \
  apps/web/src/server/modules/analysis/engine/core/evidence-collector.ts \
  apps/web/src/server/modules/analysis/engine/core/evidence.test.ts
git commit -m "feat(web): aggregate call edges into evidence"
```

---

### Task 3.5: Feed real upstream callers into the Architect digest

**Files:**
- Modify: `apps/web/src/server/modules/analysis/logic/architect-digest.ts`
- Test: `apps/web/src/server/modules/analysis/logic/architect-digest.test.ts`
- Modify: `apps/web/src/server/modules/analysis/ai/prompts-refactored.ts`
- Test: `apps/web/src/server/modules/analysis/ai/prompts-refactored.test.ts`

**Interfaces:**
- Consumes: `RepositoryEvidence.calls`
- Produces: `architectDigest.modules[].upstreamCallers: string[]`; the architecture prompt includes the field when present.

- [ ] **Step 1: Write the failing test**

Append to `architect-digest.test.ts`:

```ts
it("includes real upstream callers from resolved call edges", () => {
  const digest = buildArchitectDigest(
    documentationInput,
    metrics,
    { modules: {} },
    [],
    [],
    [
      {
        calleeName: "foo",
        callerName: "main",
        line: 1,
        path: "src/a.ts",
        resolved: true,
        targetPath: "src/b.ts",
      },
    ],
  );

  expect(digest.modules.find((module) => module.path === "src/b.ts")?.upstreamCallers).toEqual([
    "src/a.ts:main",
  ]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/logic/architect-digest.test.ts
```

Expected: FAIL because `buildArchitectDigest` does not accept a sixth argument and the field does not exist.

- [ ] **Step 3: Write the minimal implementation**

Extend `buildArchitectDigest` with an optional `calls: ResolvedCallEdge[] = []` parameter. Build a map:

```ts
const callersByTargetPath = new Map<string, string[]>();
for (const call of calls) {
  if (!call.resolved || call.targetPath == null || call.callerName == null) {
    continue;
  }
  const bucket = callersByTargetPath.get(call.targetPath) ?? [];
  bucket.push(`${call.path}:${call.callerName}`);
  callersByTargetPath.set(call.targetPath, bucket);
}
```

Add `upstreamCallers: unique(callersByTargetPath.get(module.path) ?? [])` to each module digest entry. Use `uniq` from `es-toolkit`.

In `ai-pipeline.ts`, pass `evidence.calls ?? []` as the sixth argument.

In `prompts-refactored.ts`, change the “Upstream Callers” instruction from “List of components calling this module” to:

```text
- **Upstream Callers**: Use the provided `upstreamCallers` list when it is non-empty. If it is empty, infer callers from `module_dependency_context` and mark the inference explicitly.
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/logic/architect-digest.test.ts \
  src/server/modules/analysis/ai/prompts-refactored.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/modules/analysis/logic/architect-digest.ts \
  apps/web/src/server/modules/analysis/logic/architect-digest.test.ts \
  apps/web/src/server/modules/analysis/ai/ai-pipeline.ts \
  apps/web/src/server/modules/analysis/ai/prompts-refactored.ts \
  apps/web/src/server/modules/analysis/ai/prompts-refactored.test.ts
git commit -m "feat(web): use real upstream callers in architect digest"
```

---

### Task 3.6: Deferred — exposing callers in post-analysis UI

`RepositoryEvidence` is consumed during the analysis run and is not persisted. The post-analysis inspection path (`structure-context.ts` / `inspect.ts`) only sees `RepoMetrics` and the AI result, so it cannot read `evidence.calls` without a persistence change.

Do not implement this in Milestone 3. If symbol-level callers are needed in the UI, create a separate plan that:

1. Adds a compact `callGraph` summary to `documentationInput` or `RepoMetrics`.
2. Updates `metrics.schemas.ts` and the persisted result version.
3. Adds `upstreamCallerPaths` to `StructureInspectEntryLike`.
4. Updates `buildReviewPriority` and `buildRecommendedActions`.

The Architect digest in Task 3.5 already uses real call edges during the run.

---

## Milestone 4 — AST-aware PR review, security, complexity

### Task 4.1: Map changed lines to AST nodes

**Files:**
- Create: `apps/web/src/server/modules/analysis/logic/diff-node-mapper.ts`
- Create: `apps/web/src/server/modules/analysis/logic/diff-node-mapper.test.ts`

**Interfaces:**
- Consumes: `RepositoryFile`, added line numbers
- Produces:
  - `ChangedNode = { line: number; name?: string; nodeType: string; path: string }`
  - `mapAddedLinesToNodes(file: RepositoryFile, addedLines: number[]): Promise<ChangedNode[]>`

- [ ] **Step 1: Write the failing test**

Create `diff-node-mapper.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { mapAddedLinesToNodes } from "./diff-node-mapper";

describe("mapAddedLinesToNodes", () => {
  it("walks from a changed line up to the enclosing declaration", async () => {
    const nodes = await mapAddedLinesToNodes(
      {
        content: [
          "function a() {",
          "  return 1;",
          "}",
          "function b() {",
          "  return 2;",
          "}",
        ].join("\n"),
        path: "src/a.ts",
      },
      [2, 5],
    );

    expect(nodes).toEqual([
      expect.objectContaining({ line: 2, name: "a", nodeType: "function_declaration" }),
      expect.objectContaining({ line: 5, name: "b", nodeType: "function_declaration" }),
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/logic/diff-node-mapper.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Write the minimal implementation**

Create `diff-node-mapper.ts`:

```ts
import type Parser from "web-tree-sitter";

import { getParserForExt, getSpecByExt, loadLanguage } from "@/server/core/tree-sitter";
import { getFileExtension } from "@/server/utils/path-operations";

import type { RepositoryFile } from "../engine/core/discovery.types";

export type ChangedNode = {
  line: number;
  name?: string;
  nodeType: string;
  path: string;
};

const DECLARATION_TYPES = new Set([
  "arrow_function",
  "class_declaration",
  "class_specifier",
  "function_declaration",
  "function_definition",
  "function_item",
  "method_declaration",
  "method_definition",
]);

export async function mapAddedLinesToNodes(
  file: RepositoryFile,
  addedLines: number[],
): Promise<ChangedNode[]> {
  const ext = getFileExtension(file.path);
  const spec = getSpecByExt(ext);
  if (spec == null) {
    return [];
  }

  const parser = await getParserForExt(ext);
  const language = await loadLanguage(ext, spec);
  parser.setLanguage(language);

  let tree: Parser.Tree | undefined;

  try {
    tree = parser.parse(file.content);
    const seen = new Set<string>();
    const nodes: ChangedNode[] = [];

    for (const line of addedLines) {
      let node: Parser.SyntaxNode | null = tree.rootNode.descendantForPosition({
        column: 0,
        row: Math.max(0, line - 1),
      });

      while (node != null && !DECLARATION_TYPES.has(node.type)) {
        node = node.parent;
      }

      if (node == null) {
        continue;
      }

      const key = `${line}:${node.type}:${node.startPosition.row}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      nodes.push({
        line,
        name: node.childForFieldName("name")?.text,
        nodeType: node.type,
        path: file.path,
      });
    }

    return nodes;
  } finally {
    tree?.delete();
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/logic/diff-node-mapper.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/modules/analysis/logic/diff-node-mapper.ts \
  apps/web/src/server/modules/analysis/logic/diff-node-mapper.test.ts
git commit -m "feat(web): map changed lines to AST nodes"
```

---

### Task 4.2: Use AST nodes in the PR Mapper

**Files:**
- Modify: `apps/web/src/server/modules/analysis/logic/differential-analyzer.ts`
- Modify: `apps/web/src/server/modules/analysis/tasks/analyze-pr.task.ts`
- Test: `apps/web/src/server/modules/analysis/logic/differential-analyzer.test.ts`

**Interfaces:**
- Consumes: `mapAddedLinesToNodes`, head file contents
- Produces: `DifferentialAnalyzer.analyzePRDiff` accepts `fileContents: Map<string, string>` and `runMapperPhase` emits findings for changed exported symbols/routes.

- [ ] **Step 1: Write the failing test**

Append to `differential-analyzer.test.ts`:

```ts
it("uses AST nodes for changed files when content is available", async () => {
  const analyzer = new DifferentialAnalyzer(config);
  const result = await analyzer.analyzePRDiff(
    {
      baseSha: "a",
      changedFiles: [
        {
          additions: 1,
          deletions: 0,
          filename: "src/a.ts",
          patch: "@@ -1,2 +1,3 @@\n function a() {\n+  return 1;\n }",
        },
      ],
      headSha: "b",
      owner: "o",
      prNumber: 1,
      repoName: "r",
    },
    "{}",
    metadata,
    new Map([["src/a.ts", "function a() {\n  return 1;\n}"]]),
  );

  expect(result.findings).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ file: "src/a.ts", type: "ARCHITECTURE" }),
    ]),
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/logic/differential-analyzer.test.ts
```

Expected: FAIL because `analyzePRDiff` only accepts three arguments.

- [ ] **Step 3: Write the minimal implementation**

- Add `import { mapAddedLinesToNodes } from "./diff-node-mapper";` to `differential-analyzer.ts`.
- Add a fourth optional parameter `fileContents: Map<string, string> = new Map()` to `analyzePRDiff`.
- Make the phase methods async and await them:

```ts
const sentinelFindings = await this.runSentinelPhase(
  relevantFiles,
  diffInfo.prNumber,
  fileContents,
);
const mapperFindings = await this.runMapperPhase(
  relevantFiles,
  diffInfo.prNumber,
  fileContents,
);
```

- Change the signatures to:

```ts
private async runSentinelPhase(
  files: PRDiffInfo["changedFiles"],
  _prNumber: number,
  fileContents: Map<string, string>,
): Promise<PRFinding[]> {
```

```ts
private async runMapperPhase(
  files: PRDiffInfo["changedFiles"],
  _prNumber: number,
  fileContents: Map<string, string>,
): Promise<PRFinding[]> {
```

- In `runMapperPhase`, for each file with content, call `mapAddedLinesToNodes` with the added line numbers from `extractAddedLinesFromPatch`:

```ts
const content = fileContents.get(file.filename);
if (file.patch != null && content != null) {
  const addedLines = extractAddedLinesFromPatch(file.patch).map((change) => change.lineAfter);
  const nodes = await mapAddedLinesToNodes(
    { content, path: file.filename },
    addedLines,
  );
  // emit findings from nodes
}
```

If a changed node is a `function_declaration`/`method_definition`/`class_declaration`, emit:

```ts
this.createFinding(
  file.filename,
  node.line,
  node.name ?? node.nodeType,
  `Changed ${node.nodeType.replaceAll("_", " ")}: ${node.name ?? "(anonymous)"}`,
  4,
  "LOW",
  "Review the changed declaration and its callers before merging.",
  "ARCHITECTURE",
);
```

- In `analyze-pr.task.ts`, fetch head file contents for changed files up to 1 MB:

```ts
const fileContents = new Map<string, string>();
for (const file of changedFiles) {
  if (file.patch == null) {
    continue;
  }
  const response = await octokit.rest.repos.getContent({
    owner: payload.owner,
    path: file.filename,
    ref: payload.headSha,
    repo: payload.repoName,
  });
  if (Array.isArray(response.data) || response.data.type !== "file") {
    continue;
  }
  if (response.data.size > 1_000_000) {
    continue;
  }
  const content = Buffer.from(response.data.content, "base64").toString("utf8");
  fileContents.set(file.filename, content);
}
```

Pass `fileContents` to `analyzePRDiff`.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/logic/differential-analyzer.test.ts \
  src/server/modules/analysis/tasks/analyze-pr.task.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/modules/analysis/logic/differential-analyzer.ts \
  apps/web/src/server/modules/analysis/logic/differential-analyzer.test.ts \
  apps/web/src/server/modules/analysis/tasks/analyze-pr.task.ts \
  apps/web/src/server/modules/analysis/tasks/analyze-pr.task.test.ts
git commit -m "feat(web): use ast nodes in pr mapping"
```

---

### Task 4.3: Add AST security sink queries

**Files:**
- Create: `apps/web/src/server/modules/analysis/engine/extractors/security-query-specs.ts`
- Create: `apps/web/src/server/modules/analysis/engine/extractors/security-signals.ts`
- Create: `apps/web/src/server/modules/analysis/engine/extractors/security-signals.test.ts`
- Modify: `apps/web/src/server/modules/analysis/logic/differential-analyzer.ts`

**Interfaces:**
- Consumes: `RepositoryFile`, `getParserForExt`, `compileQuery`
- Produces:
  - `SECURITY_QUERY_SPECS: Partial<Record<string, string>>`
  - `collectAstSecurityFindings(file: RepositoryFile): Promise<SecurityFindingMetric[]>`

- [ ] **Step 1: Write the failing test**

Create `security-signals.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { collectAstSecurityFindings } from "./security-signals";

describe("collectAstSecurityFindings", () => {
  it("flags a real eval call but not a string or comment", async () => {
    const findings = await collectAstSecurityFindings({
      content: [
        'const text = "eval(userInput)";',
        "// eval(userInput)",
        "eval(userInput);",
      ].join("\n"),
      path: "src/a.ts",
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toEqual(expect.objectContaining({ line: 3, severity: "warning" }));
  });

  it("flags child_process.exec", async () => {
    const findings = await collectAstSecurityFindings({
      content: 'import { exec } from "child_process";\nexec("rm -rf /");',
      path: "src/b.ts",
    });

    expect(findings).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/security-signals.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Write the minimal implementation**

Create `security-query-specs.ts`:

```ts
export const SECURITY_QUERY_SPECS: Partial<Record<string, string>> = {
  ".cjs": `
    (call_expression function: (identifier) @sink.name (#match? @sink.name "^(eval|Function|exec|execSync|spawn|spawnSync)$")) @sink.call
    (call_expression function: (member_expression object: (identifier) @sink.object property: (property_identifier) @sink.method) (#match? @sink.object "^(child_process|vm)$")) @sink.call
  `,
  ".js": `
    (call_expression function: (identifier) @sink.name (#match? @sink.name "^(eval|Function|exec|execSync|spawn|spawnSync)$")) @sink.call
    (call_expression function: (member_expression object: (identifier) @sink.object property: (property_identifier) @sink.method) (#match? @sink.object "^(child_process|vm)$")) @sink.call
    (assignment_expression left: (member_expression property: (property_identifier) @sink.property) (#match? @sink.property "^(innerHTML|outerHTML)$")) @sink.call
  `,
  ".jsx": `
    (call_expression function: (identifier) @sink.name (#match? @sink.name "^(eval|Function|exec|execSync|spawn|spawnSync)$")) @sink.call
    (jsx_attribute (property_identifier) @sink.attr (#match? @sink.attr "^dangerouslySetInnerHTML$")) @sink.call
  `,
  ".ts": `
    (call_expression function: (identifier) @sink.name (#match? @sink.name "^(eval|Function|exec|execSync|spawn|spawnSync)$")) @sink.call
    (call_expression function: (member_expression object: (identifier) @sink.object property: (property_identifier) @sink.method) (#match? @sink.object "^(child_process|vm)$")) @sink.call
    (assignment_expression left: (member_expression property: (property_identifier) @sink.property) (#match? @sink.property "^(innerHTML|outerHTML)$")) @sink.call
  `,
  ".tsx": `
    (call_expression function: (identifier) @sink.name (#match? @sink.name "^(eval|Function|exec|execSync|spawn|spawnSync)$")) @sink.call
    (call_expression function: (member_expression object: (identifier) @sink.object property: (property_identifier) @sink.method) (#match? @sink.object "^(child_process|vm)$")) @sink.call
    (jsx_attribute (property_identifier) @sink.attr (#match? @sink.attr "^dangerouslySetInnerHTML$")) @sink.call
  `,
};
```

Create `security-signals.ts`:

```ts
import type Parser from "web-tree-sitter";

import { getParserForExt, getSpecByExt, loadLanguage } from "@/server/core/tree-sitter";
import { compileQuery } from "@/server/core/tree-sitter/query-cache";

import type { RepositoryFile, SecurityFindingMetric } from "../core/discovery.types";
import { getFileExtension } from "@/server/utils/path-operations";
import { capturesByName, firstCapture } from "./queries/captures";
import { SECURITY_QUERY_SPECS } from "./security-query-specs";

export async function collectAstSecurityFindings(
  file: RepositoryFile,
): Promise<SecurityFindingMetric[]> {
  const ext = getFileExtension(file.path);
  const spec = getSpecByExt(ext);
  const querySource = SECURITY_QUERY_SPECS[ext];
  if (spec == null || querySource == null) {
    return [];
  }

  const parser = await getParserForExt(ext);
  const language = await loadLanguage(ext, spec);
  parser.setLanguage(language);

  let tree: Parser.Tree | undefined;

  try {
    tree = parser.parse(file.content);
    const query = await compileQuery(ext, spec, querySource);
    const findings: SecurityFindingMetric[] = [];
    const seen = new Set<number>();

    for (const match of query.matches(tree.rootNode)) {
      const captures = capturesByName(match.captures);
      const sink =
        firstCapture(captures, "sink.name") ??
        firstCapture(captures, "sink.method") ??
        firstCapture(captures, "sink.property") ??
        firstCapture(captures, "sink.attr");
      if (sink == null) {
        continue;
      }

      const line = sink.startPosition.row + 1;
      if (seen.has(line)) {
        continue;
      }
      seen.add(line);

      findings.push({
        line,
        message: `AST sink detected: ${sink.text}`,
        path: file.path,
        severity: "warning",
      });
    }

    return findings;
  } finally {
    tree?.delete();
  }
}
```

In `DifferentialAnalyzer.runSentinelPhase`, before the regex loops:

```ts
const astFindings = await Promise.all(
  files.map(async (file) => {
    const content = fileContents.get(file.filename);
    if (content == null) {
      return [];
    }
    return collectAstSecurityFindings({ content, path: file.filename });
  }),
);

for (const finding of astFindings.flat()) {
  findings.push(
    this.createFinding(
      finding.path,
      finding.line ?? 1,
      finding.message,
      finding.message,
      8,
      "HIGH",
      "Replace the unsafe sink with a safe API or validate the input.",
    ),
  );
}
```

Pass `fileContents` into `runSentinelPhase` from Task 4.2.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/security-signals.test.ts \
  src/server/modules/analysis/logic/differential-analyzer.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/modules/analysis/engine/extractors/security-query-specs.ts \
  apps/web/src/server/modules/analysis/engine/extractors/security-signals.ts \
  apps/web/src/server/modules/analysis/engine/extractors/security-signals.test.ts \
  apps/web/src/server/modules/analysis/logic/differential-analyzer.ts
git commit -m "feat(web): add ast security sink queries"
```

---

### Task 4.4: Compute per-function complexity

**Files:**
- Modify: `apps/web/src/server/modules/analysis/engine/extractors/queries/types.ts`
- Modify: `apps/web/src/server/modules/analysis/engine/extractors/query-signals.ts`
- Modify: `apps/web/src/server/modules/analysis/engine/core/discovery.types.ts`
- Test: `apps/web/src/server/modules/analysis/engine/extractors/query-signals.test.ts`

**Interfaces:**
- Consumes: `LanguageQuerySpec.complexityNodeTypes`
- Produces: `FileSignals.functionComplexities?: Array<{ complexity: number; line: number; maxNesting: number; name: string }>`

- [ ] **Step 1: Write the failing test**

Append to `query-signals.test.ts`:

```ts
it("computes complexity per function", async () => {
  const result = await collectQuerySignals(
    {
      content: [
        "function simple() { return 1; }",
        "function branchy(a: number) { if (a) { return 1; } return 0; }",
      ].join("\n"),
      path: "src/complexity.ts",
    },
    ".ts",
    typescriptQuerySpec,
  );

  expect(result?.functionComplexities).toEqual([
    expect.objectContaining({ complexity: 1, name: "simple" }),
    expect.objectContaining({ complexity: 2, name: "branchy" }),
  ]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/query-signals.test.ts
```

Expected: FAIL because `functionComplexities` is `undefined`.

- [ ] **Step 3: Write the minimal implementation**

Add to `LanguageQuerySpec`:

```ts
complexityNodeTypes: string[];
```

Add the array to every language spec. Use the branch node names from that language’s `complexity` query:

| Spec | `complexityNodeTypes` |
|---|---|
| TypeScript / JavaScript | `if_statement`, `for_statement`, `for_in_statement`, `while_statement`, `do_statement`, `switch_statement`, `catch_clause`, `ternary_expression` |
| Python | `if_statement`, `elif_clause`, `for_statement`, `while_statement`, `try_statement`, `except_clause`, `with_statement`, `conditional_expression`, `boolean_operator` |
| Go | `if_statement`, `for_statement`, `expression_case`, `type_case`, `communication_case` |
| Rust | `if_expression`, `for_expression`, `while_expression`, `loop_expression`, `match_arm` |
| Java | `if_statement`, `for_statement`, `enhanced_for_statement`, `while_statement`, `do_statement`, `switch_expression`, `catch_clause`, `ternary_expression` |
| C# | `if_statement`, `for_statement`, `foreach_statement`, `while_statement`, `do_statement`, `switch_statement`, `catch_clause`, `conditional_expression` |
| PHP | `if_statement`, `for_statement`, `foreach_statement`, `while_statement`, `do_statement`, `switch_statement`, `catch_clause`, `conditional_expression` |
| C / C++ | `if_statement`, `for_statement`, `while_statement`, `do_statement`, `switch_statement`, `case_statement`, `conditional_expression` |
| Bash | `if_statement`, `for_statement`, `while_statement`, `case_statement` |
| Lua | `if_statement`, `for_statement`, `while_statement`, `repeat_statement` |
| Objective-C | `if_statement`, `for_statement`, `while_statement`, `do_statement`, `switch_statement` |
| Swift | `if_statement`, `for_statement`, `while_statement`, `repeat_while_statement`, `switch_statement`, `catch_clause` |

Do not put `binary_expression` in `complexityNodeTypes` for languages where it also matches arithmetic; the file-level `complexity` query already counts logical operators with explicit operator predicates. Per-function counting deliberately counts control-flow constructs only.

For TypeScript the array is:

```ts
complexityNodeTypes: [
  "if_statement",
  "for_statement",
  "for_in_statement",
  "while_statement",
  "do_statement",
  "switch_statement",
  "catch_clause",
  "ternary_expression",
],
```

In `query-signals.ts`, declare the declaration map before the symbol loop:

```ts
const symbolDeclarations = new Map<string, Parser.SyntaxNode>();
```

Inside the symbol loop, after computing `declaration`, add:

```ts
symbolDeclarations.set(`${name}:${(declaration ?? nameNode).startPosition.row}`, declaration ?? nameNode);
```

Use the same `${symbol.name}:${symbol.line ?? 1}` key when reading it. The line component keeps same-named methods in different classes from overwriting each other.

After symbols are collected:

```ts
const functionComplexities = symbols
  .map((symbol) => {
    const declaration = symbolDeclarations.get(`${symbol.name}:${symbol.line ?? 1}`);
    const body = declaration?.childForFieldName("body");
    if (body == null) {
      return null;
    }

    return {
      complexity: 1 + body.descendantsOfType(querySpec.complexityNodeTypes).length,
      line: symbol.line ?? 1,
      maxNesting: computeMaxNesting(body, querySpec.nestingNodeTypes),
      name: symbol.name,
    };
  })
  .filter((item): item is NonNullable<typeof item> => item != null);
```

Return `functionComplexities`.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/query-signals.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/modules/analysis/engine/extractors/queries/types.ts \
  apps/web/src/server/modules/analysis/engine/extractors/queries/*.ts \
  apps/web/src/server/modules/analysis/engine/extractors/query-signals.ts \
  apps/web/src/server/modules/analysis/engine/core/discovery.types.ts \
  apps/web/src/server/modules/analysis/engine/extractors/query-signals.test.ts
git commit -m "feat(web): compute per-function complexity"
```

---

### Task 4.5: Update metrics and docs for per-function complexity

**Files:**
- Modify: `apps/web/src/server/modules/analysis/engine/metrics/code-metrics.ts`
- Modify: `apps/web/src/server/modules/analysis/engine/metrics/code-metric-scan.ts`
- Modify: `apps/web/src/server/modules/analysis/engine/core/metrics.types.ts` (only if you add a persisted field)
- Modify: `apps/web/content/docs/concepts/metrics.mdx`
- Test: `apps/web/src/server/modules/analysis/engine/metrics/code-metric-scan.test.ts`

**Interfaces:**
- Consumes: `FileSignals.functionComplexities`
- Produces: `mostComplexFiles` still ranks by the file score; `functionComplexities` is available for future UI and prompt use. Do not add a persisted field unless the Zod schema in `metrics.schemas.ts` is updated in the same task.

- [ ] **Step 1: Write the failing test**

Append to `code-metric-scan.test.ts`:

```ts
it("keeps the file score stable and records per-function complexity separately", () => {
  const scan = aggregateScanResults([
    {
      comments: 0,
      complexity: 3,
      maxNesting: 2,
      normalizedPath: "src/a.ts",
      prettyName: "TypeScript",
      securityFindings: [],
      securityIssues: 0,
      securityScanStatus: "ok",
      signal: {
        analysisMode: "tree-sitter",
        apiSurface: 0,
        complexityMetrics: { complexity: 3, maxNesting: 2 },
        confidence: 80,
        entrypointHint: false,
        exports: 0,
        functionComplexities: [
          { complexity: 1, line: 1, maxNesting: 1, name: "a" },
          { complexity: 2, line: 2, maxNesting: 2, name: "b" },
        ],
        imports: [],
        path: "src/a.ts",
        source: "extraction",
        symbols: [],
      },
      size: 100,
      source: 10,
      todos: 0,
    },
  ]);

  expect(scan.mostComplexFiles).toEqual(["src/a.ts"]);
  expect(scan.fileSignalsByPath.get("src/a.ts")?.functionComplexities).toHaveLength(2);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/metrics/code-metric-scan.test.ts
```

Expected: FAIL because `functionComplexities` is not part of the `FileSignals` fixture type.

- [ ] **Step 3: Write the minimal implementation**

- If `complexity` on the file score should remain the sum of branch nodes, keep `scanRepositoryFile` using `signal.complexityMetrics.complexity`.
- Do not add `functionComplexities` to `RepoMetrics` yet. It stays on `FileSignals` and is available to prompts via `fileSignalsByPath`.
- Update `content/docs/concepts/metrics.mdx`:

```text
Cyclomatic complexity measures branching density per function. Doxynix computes a per-function
score from the Tree-sitter AST and keeps those scores on the file signals. The file-level score
shown in the dashboard remains the total branch count for the file, so historical comparisons stay
stable.
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/metrics/code-metric-scan.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/modules/analysis/engine/metrics/code-metrics.ts \
  apps/web/src/server/modules/analysis/engine/metrics/code-metric-scan.ts \
  apps/web/src/server/modules/analysis/engine/metrics/code-metric-scan.test.ts \
  apps/web/content/docs/concepts/metrics.mdx
git commit -m "docs(web): describe per-function complexity"
```

---

## Milestone 5 — Optional runtime and grammar upgrade

Do not start this milestone until Milestones 0–4 are merged and the full gate passes.

### Task 5.1: Spike `web-tree-sitter` 0.27.x

**Files:**
- Modify temporarily: `apps/web/package.json`, `bun.lock`
- Create: `docs/superpowers/notes/2026-11-09-tree-sitter-upgrade-spike.md`

**Interfaces:**
- Consumes: current query specs and grammar bundle
- Produces: a written go/no-go decision. Do not merge the dependency bump unless every supported grammar loads and every query compiles.

- [ ] **Step 1: Create a throwaway branch and bump the runtime**

```bash
git switch -c spike/tree-sitter-0-27
bun add --cwd apps/web web-tree-sitter@0.27.2
bun install
bun run clean:symlinks
```

- [ ] **Step 2: Run the query smoke matrix**

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/queries
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/query-signals.test.ts
```

Expected: all pass. If a grammar fails with `Incompatible language version`, record the grammar and its ABI.

- [ ] **Step 3: Adapt the runtime if imports changed**

`0.26+` exposes named exports (`import { Language, Parser } from "web-tree-sitter"`). Update `initRuntime` in `core/tree-sitter/index.ts` only if the existing `mod.Parser`/`mod.default` fallbacks stop working.

- [ ] **Step 4: Write the decision note**

Create `docs/superpowers/notes/2026-11-09-tree-sitter-upgrade-spike.md` with:

```markdown
# Tree-sitter 0.27 spike

- Runtime: 0.27.2 (2026-11-07)
- Grammar bundle: tree-sitter-wasms 0.1.13 (2025-10-07)
- Query specs passing:
- Grammars failing ABI:
- Trigger build impact:
- Decision: merge / defer
```

- [ ] **Step 5: Clean up or commit**

If the spike fails, delete the branch:

```bash
git switch main
git branch -D spike/tree-sitter-0-27
```

If it passes, commit the dependency bump and the note:

```bash
git add apps/web/package.json bun.lock docs/superpowers/notes/2026-11-09-tree-sitter-upgrade-spike.md
git commit -m "chore(web): upgrade web-tree-sitter"
```

---

### Task 5.2: Replace broken or missing grammars

**Files:**
- Create: `apps/web/vendor/wasms/` (built wasm files)
- Modify: `apps/web/src/server/core/tree-sitter/index.ts`
- Modify: `apps/web/trigger.config.ts`
- Test: `apps/web/src/server/modules/analysis/engine/extractors/tree-sitter-signals.test.ts`

**Interfaces:**
- Consumes: `tree-sitter-cli` and grammar packages as dev dependencies
- Produces: working `.rb`, `.erl`, `.jl` grammars; `resolveGrammarWasmPath` already checks `vendor/wasms`.

- [ ] **Step 1: Build the missing grammars**

```bash
bun add -d tree-sitter-cli tree-sitter-ruby tree-sitter-erlang tree-sitter-julia
mkdir -p apps/web/vendor/wasms
bun x tree-sitter build --wasm node_modules/tree-sitter-ruby -o apps/web/vendor/wasms/tree-sitter-ruby.wasm
bun x tree-sitter build --wasm node_modules/tree-sitter-erlang -o apps/web/vendor/wasms/tree-sitter-erlang.wasm
bun x tree-sitter build --wasm node_modules/tree-sitter-julia -o apps/web/vendor/wasms/tree-sitter-julia.wasm
bun run clean:symlinks
```

- [ ] **Step 2: Add a smoke test**

```ts
it.each([
  [".rb", "def f; nil; end"],
  [".erl", "-module(x)."],
  [".jl", "function f() end"],
])("parses %s without throwing", async (ext, content) => {
  const result = await collectTreeSitterSignals({ content, path: `src/sample${ext}` });
  expect(result).not.toBeNull();
});
```

- [ ] **Step 3: Add the vendor directory to the Trigger build**

In `apps/web/trigger.config.ts`:

```ts
additionalFiles({
  files: [
    "node_modules/web-tree-sitter/tree-sitter.wasm",
    "node_modules/tree-sitter-wasms/out/*.wasm",
    "vendor/wasms/*.wasm",
  ],
}),
```

- [ ] **Step 4: Run the test**

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors/tree-sitter-signals.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/vendor/wasms apps/web/trigger.config.ts \
  apps/web/src/server/core/tree-sitter/index.ts \
  apps/web/src/server/modules/analysis/engine/extractors/tree-sitter-signals.test.ts
git commit -m "fix(web): bundle working ruby erlang julia grammars"
```

---

### Task 5.3: Decide on SCIP/LSP for precise references

**Files:**
- Create: `docs/superpowers/notes/2026-11-09-scip-lsp-decision.md`

**Interfaces:**
- Consumes: Milestone 3 call graph results
- Produces: a written decision on whether to add SCIP/LSP for TS/Java/Rust. Do not add a dependency in this task.

- [ ] **Step 1: Measure the current call-graph coverage**

Add a temporary script under `apps/web/scripts/benchmarks/` that prints:

```text
resolved call edges / total call sites
resolved import edges / total import specifiers
```

Run it against the Doxynix repository itself.

- [ ] **Step 2: Write the decision note**

```markdown
# SCIP/LSP decision

- Current resolved call-edge coverage:
- Languages with the worst coverage:
- Cost of adding SCIP indexers (TypeScript, Java, Rust):
- Runtime cost in Trigger.dev:
- Decision: add SCIP for <language> / defer
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/notes/2026-11-09-scip-lsp-decision.md
git commit -m "docs(web): record scip lsp decision"
```

---

## 4. Verification Checklist

Run at the end of Milestone 0:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors
bun --filter @doxynix/web test src/server/modules/analysis/engine/core/evidence-support.test.ts
bun run lint
```

Run at the end of Milestone 1:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors src/server/core/tree-sitter
bun --filter @doxynix/web test src/server/modules/analysis/engine/core/evidence-support.test.ts
bun run type-check
```

Run at the end of Milestone 2:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/extractors
bun --filter @doxynix/web test src/server/modules/analysis
```

Run at the end of Milestone 3:

```bash
bun --filter @doxynix/web test src/server/modules/analysis/engine/core
bun --filter @doxynix/web test src/server/modules/analysis/logic
bun --filter @doxynix/web test src/server/modules/analysis/ai
```

Run at the end of Milestone 4:

```bash
bun --filter @doxynix/web test src/server/modules/analysis
bun run validate
```

The full gate is `bun run validate` from the repository root. It runs Biome, Oxlint, FSD lint, i18n lint, locale shape checks, `arch:check`, index parity, and type-check. Do not claim a milestone is complete until the relevant gate passes.

---

## 5. Plan Self-Review

**Spec coverage:**

- Real symbol names: Task 0.1.
- Real exports: Task 0.2.
- Route dedupe/framework: Task 0.3, Task 1.7.
- Grammar correctness and parse errors: Task 0.4.
- Parser/cursor lifecycle: Task 0.5.
- Docs truthfulness: Task 0.6, Task 4.5.
- Query runtime: Task 1.1–1.2.
- TS/JS extraction: Task 1.3–1.5.
- Type extensions: Task 1.6.
- Polyglot specs: Tasks 2.1–2.9.
- Legacy removal: Task 2.10.
- Symbol index: Task 3.1.
- Call graph: Tasks 3.2–3.4.
- Architect digest: Task 3.5. Post-analysis UI inspection is deferred in Task 3.6.
- PR AST mapping: Tasks 4.1–4.2.
- AST security: Task 4.3.
- Per-function complexity: Tasks 4.4–4.5.
- Optional upgrade: Tasks 5.1–5.3.

**Placeholder scan:** Every code step contains the actual code or the exact query strings. The only “replace with your ticket” instruction is the branch name, which is environment metadata, not implementation content.

**Type consistency:** `LanguageQuerySpec`, `FileSignals`, `SymbolRef`, `ImportRef`, `CallSite`, `ResolvedCallEdge`, and `ChangedNode` are defined before they are used. Function names are consistent across tasks: `compileQuery`, `getParserForExt`, `collectQuerySignals`, `buildSymbolIndex`, `resolveExportedSymbol`, `extractCallSites`, `resolveCallSites`, `mapAddedLinesToNodes`, `collectAstSecurityFindings`.

**Known trade-offs:**

- Queries are grammar-specific. Every language task adds a fixture test that fails if a node name or field name is wrong.
- Query compilation happens once per extension + source and is cached for the process lifetime. Tests must call `disposeQueries()`.
- The `exports` count now means “unique exported symbol names”, not “declaration count”. Historical metric comparisons will shift. This is intentional and should be noted in the release notes.
- The UI graph stays file/group. Symbol-level data is used by prompts, metrics, and impact analysis, not by XYFlow nodes.
- SCIP/LSP is explicitly deferred to a decision note.

---

## 6. Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-11-09-tree-sitter-query-extraction.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration. REQUIRED SUB-SKILL: `subagent-driven-development`.
2. **Inline Execution** — execute tasks in this session with `executing-plans`, batch execution with checkpoints for review.

Nothing has been executed. Pick an option when you are ready.
