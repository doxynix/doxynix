# SCIP/LSP decision

Status: deferred. No dependency was added and no production code changed.

Scope: whether the repository analysis pipeline should back its call graph with
SCIP indexes and/or language servers, for TypeScript, Java, Rust, or any other
language already covered by the tree-sitter query specs.

## Current state

The in-process call graph is the Milestone 3 baseline and lives in three files:

- `apps/web/src/server/modules/analysis/engine/core/call-graph.ts` — extracts
  `CallSite`s via per-language queries, then resolves them.
- `apps/web/src/server/modules/analysis/engine/core/symbol-index.ts` — builds
  `byPath` / `exportedByPath` maps from the extracted `SymbolRef[]` and exposes
  `resolveExportedSymbol`.
- `apps/web/src/server/modules/analysis/engine/core/evidence.ts` — builds the
  index, normalizes per-file `ImportRef[]`, and stores the resulting
  `ResolvedCallEdge[]` on `RepositoryEvidence.calls`.

What it resolves:

- Free-function calls whose callee name matches a name bound by a named or
  default import in the same file, where the import specifier resolves to an
  in-repo path and that path exports a symbol with the same name.
- Import specifiers resolve through relative paths first, then module imports
  with alias rules (`resolveRelativeImport` / `resolveModuleImport`).
- Resolution is purely name-based, intra-procedural-free, and needs no
  compiler.

What it does not resolve:

- Receiver calls (`this.foo()`, `obj.method()`, `self.run()`, `ns.foo()`). Any
  `member_expression` call carries `call.object`, and `resolveCallSites` returns
  `resolved: false` for every site with a receiver.
- Intra-file calls. `resolveCallSites` only consults `ImportRef[]`; a call to a
  function declared in the same file is unresolved.
- Re-export chains, barrel files that forward under a different exported name,
  `require()` / dynamic import bindings (both `require` and `side-effect` kinds
  are skipped), and any call whose type information is needed to pick the
  target.
- Type-aware dispatch: overloads, interface implementations, generic
  instantiations, and cross-package `.d.ts` resolution.

Language coverage:

- 18 query specs (bash, C, C++, C#, Erlang, Go, Java, JavaScript, Julia,
  Kotlin, Lua, Objective-C, PHP, Python, Ruby, Rust, Swift, TypeScript) mapped
  to 24 file extensions and 19 WASM grammars; all 18 specs define a `calls`
  query.
- Only the JavaScript and TypeScript specs capture `@import.default` /
  `@import.named`. Every other spec captures only `@import.source`, which the
  extractor classifies as `side-effect` or `require`, and `resolveCallSites`
  skips both. In practice, call resolution is therefore JS/TS-family only
  (`.js`, `.jsx`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.cts`, `.mts`); the other 16
  languages produce call sites that never resolve, plus import edges that
  resolve without names.
- One known false-positive mode follows from name matching: a bare call whose
  name collides with any imported name in the same file is attributed to that
  import even when it is a local declaration or a global.

## Why SCIP/LSP is not in the current plan

The plan explicitly excludes SCIP and LSP (see "Do not introduce ... SCIP, or
LSP in this plan. They are separate decisions."). Three reasons:

1. SCIP is not a syntax extractor. It is a code-intelligence output produced by
   a per-language indexer that already has a compiler or type checker:
   `scip-typescript` needs the TS program, `scip-java` needs a resolved
   classpath and the JVM, `rust-analyzer` needs a cargo project. The current
   engine runs a WASM grammar on file contents and never asks whether a
   checkout is buildable.
2. It multiplies the runtime surface. Today the Trigger.dev image ships
   `web-tree-sitter.wasm` plus one WASM grammar per language and runs
   everywhere Bun runs. SCIP would add a JVM, a Rust toolchain, Node-only
   indexers, and per-language build metadata to the Trigger build, with a
   different compatibility story per language.
3. It needs a persistence and indexing layer that does not exist. SCIP indexes
   are large per-repository artifacts that must be generated, stored, versioned
   per commit, and joined against extracted symbols — a new subsystem, not an
   improvement to the existing one.

SCIP solves type-aware cross-file references. The pipeline needs syntax-level
facts, prompts, and metrics; the gap between the two is real but not a
correctness bug in the current milestone.

## Cost/benefit

What would improve with SCIP/LSP:

- Exact reference targets instead of name matching: no false positives from
  shadowed or coincidentally named callables.
- A type-aware call graph: interface dispatch, overload selection, and
  receiver calls (`this.foo()`) become resolvable.
- Impact analysis and PR-review context could follow real references rather
  than import-name heuristics.

What it costs:

- Per-language toolchains: `scip-typescript` (Node + a working `tsconfig`),
  `scip-java` (JVM + resolvable classpath), `rust-analyzer` (Rust toolchain +
  `cargo metadata`), and equivalents for the other 15 languages if we want
  parity with the existing spec list.
- Build time and failure modes: index generation is a full type-check per
  repository and fails on unbuildable checkouts, missing lockfiles, private
  registries, or native dependencies — exactly the repositories the analyzer is
  supposed to survive.
- Storage: one index per repository per commit, plus garbage collection.
- Runtime compatibility: arbitrary native binaries inside the Trigger.dev build
  and Bun-run code paths, instead of a single portable WASM runtime.
- Two sources of truth: SCIP symbols would have to be reconciled with the
  tree-sitter `SymbolRef`/`CallSite` model, or one model would win and the
  extractors would become redundant.

## Decision

Defer SCIP/LSP. Keep the current best-effort call graph, and document its
limits rather than replacing them with a heavier subsystem.

Revisit if type-aware cross-file references become a product requirement — for
example, if impact analysis or PR review must follow receiver calls or
interface dispatch, or if a customer asks for a language where name matching
produces visibly wrong answers. At that point, start with one language
(TypeScript, because `scip-typescript` is the cheapest indexer and it matches
the repo's own stack) and prove the cost before widening.

## Measurement plan

No coverage measurement was run for this note. When it is needed, measure it
from the existing evidence rather than adding a permanent benchmark:

1. Run the analysis pipeline over a checkout (the same path
   `collectRepositoryEvidence` already takes) and keep the resulting
   `RepositoryEvidence`.
2. Call coverage: `resolved = evidence.calls.filter((call) => call.resolved)`
   over `evidence.calls.length`. Report both numbers and the ratio, plus a
   breakdown by file extension so the JS/TS-only effect is visible.
3. Import coverage: `resolvedEdges` over
   `resolvedEdges + unresolvedImportSpecifiers` from
   `evidence.dependencyGraph`.
4. Run it against this repository and against at least one polyglot repository,
   and record the date and commit in the result. A one-off script under
   `apps/web/scripts/` is enough; do not wire it into CI until the numbers are
   used by a decision.

Until that measurement exists, no coverage percentage should be quoted from
this note.
