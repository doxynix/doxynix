# Server Refactor Log

## Audit Snapshot

### Confirmed architectural issues
- `entities/analyze/lib` contains circular dependencies:
  - `graph-navigator -> semantics -> graph-navigator`
  - `graph-navigator -> analysis-utils -> edge-builder -> graph-navigator`
  - `analysis-utils -> semantics -> analysis-utils`
- `shared/lib/collectors/route-collector.ts` has broken relative imports.
- `entities/analyze/lib/analysis-utils.ts` is overloaded:
  - payload coercion
  - docs summary helpers
  - structure context building
  - navigation helpers
- `entities/analyze/lib/semantics.ts` is overloaded:
  - path grouping
  - semantic classification
  - ranking/meaningfulness
  - generic bucket penalty
- `shared/engine` biggest files still are:
  - `core/types.ts`
  - `pipeline/documentation-input.ts`
  - `metrics/code-metrics.ts`
  - `core/evidence.ts`
- `extractors` already have a partial unified adapter shape; immediate value is lower there than in `entities/analyze/lib`.

### Current validation baseline
- `pnpm arch:check` currently reports:
  - circulars in `entities/analyze/lib`
  - unresolved imports in `shared/lib/collectors/route-collector.ts`
  - unrelated environment/dependency issues in broader server graph
- `pnpm tsc --noEmit` still has environment-level type-resolution failures (`next`, `trigger`, Node typings in current shell), so refactor validation must distinguish local regressions from existing environment noise.

## Wave 1
- Remove direct `graph-navigator` coupling from `semantics.ts` and `edge-builder.ts`
- Fix `route-collector.ts` import paths
- Keep behavior unchanged
- Re-run:
  - `pnpm arch:check`
  - `pnpm tsc --noEmit`

### Wave 1 Result
- Added `src/server/entities/analyze/lib/structure-shared.ts` as the single source for:
  - structure types
  - node id helpers
  - scope/path helpers
- Moved `semantics.ts`, `edge-builder.ts`, `graph-navigator.ts`, `node-explainer.ts`, `context.ts` to import shared structure contracts directly.
- Deleted dead file `src/server/shared/lib/collectors/route-collector.ts`.
- Result:
  - all `entities/analyze/lib` circulars removed from `pnpm arch:check`
  - local `tsc` regressions from this refactor eliminated
  - remaining `tsc` failures are environment/module-resolution noise outside this wave

## Wave 2
- Split `analysis-utils.ts` into:
  - payload/docs helpers
  - structure-context builder
  - navigation helpers
- Export only narrow contracts through `entities/analyze/lib/index.ts`

### Wave 2 Result
- Added `src/server/entities/analyze/lib/payload.ts` and moved:
  - `coerceAnalysisPayload`
  - doc summary/writer status helpers
- `repo-details.presenter.ts` now imports payload/doc helpers directly from `payload.ts`.
- `analysis-utils.ts` is now narrower and focused on:
  - structure context
  - breadcrumbs
  - scoped aggregation/navigation helpers
- Size impact:
  - `analysis-utils.ts` reduced to 11045 bytes
  - `common-metrics.ts` reduced to 5261 bytes after dead wrapper cleanup/refactor

## Wave 3
- Revisit `shared/engine` only after `entities/analyze/lib` cycles are under control
- Target first:
  - `metrics/code-metrics.ts`
  - `pipeline/documentation-input.ts`
  - `core/evidence.ts`

### Wave 3 Result
- Broke `shared/engine/metrics` cycle by extracting duplication logic into:
  - `src/server/shared/engine/metrics/duplication-metrics.ts`
- Kept `common-metrics.ts` public API stable by restoring `calculateCodeMetrics()` compatibility wrapper.
- `pnpm arch:check` now reports:
  - no circulars in `entities/analyze/lib`
  - no circular in `shared/engine/metrics`
  - remaining issues are:
    - router/github slice cycles
    - `not-to-dev-dep` policy violations for runtime imports of `typescript` and `pino-pretty`

## Wave 4
- Remove router/github cycles via lower shared contracts
- Split `pipeline/documentation-input.ts`
- Split `core/evidence.ts`
- Remove raw `console.*` from touched server modules

### Wave 4 Result
- Broke all three router/github cycles by moving `RepoVisibility` off `shared/api/trpc` and into:
  - `src/shared/types/repo.types.ts`
- Updated UI visibility mapping to use the lower shared contract:
  - `src/entities/repo/model/repo-visibility.ts`
- Split `documentation-input.ts` into:
  - `src/server/shared/engine/pipeline/documentation-input.ts`
  - `src/server/shared/engine/pipeline/documentation-input-context.ts`
  - `src/server/shared/engine/pipeline/documentation-input-sections.ts`
- Split `evidence.ts` into:
  - `src/server/shared/engine/core/evidence.ts`
  - `src/server/shared/engine/core/evidence-support.ts`
  - `src/server/shared/engine/core/evidence-collector.ts`
  - `src/server/shared/engine/core/evidence-derived.ts`
- Size impact:
  - `documentation-input.ts`: 82 -> 26 lines facade
  - `evidence.ts`: 516 -> 103 lines facade
- Colocation cleanup:
  - moved single-use `buildApiInput/buildArchitectureInput/buildCodebaseInput/buildReportInput/buildRiskInput` back into `documentation-input.ts`
- Logging cleanup:
  - removed raw `console.*` from `src/server`
  - replaced with structured logger usage in:
    - `src/server/api/context.ts`
    - `src/server/shared/lib/evidence-formatter.ts`
    - `src/server/shared/lib/safety-context.ts`
    - `src/server/shared/engine/core/scoring-constants.ts`
- Validation after wave:
  - `pnpm arch:check` reduced from 9 violations to 6 and stayed stable after file splits
  - remaining arch violations are only:
    - 5 `not-to-dev-dep` errors
    - 1 deprecated `async_hooks` warning
  - filtered `tsc` on touched files shows no local regressions from this wave; remaining errors are environment/module-resolution issues (`next`, `node`, `trigger`, etc.)

## Wave 5
- Consolidate repository-discovery heuristics into one shared policy center
- Turn policy consumers into thin adapters
- Remove duplicated architecture relevance checks from downstream modules

### Wave 5 Result
- Added:
  - `src/server/shared/engine/core/project-policy-rules.ts`
  - `src/server/shared/engine/core/project-policy.ts`
- Turned `patterns.ts` into a compatibility facade over the new rule registry.
- Centralized the only valid answers for:
  - entrypoint eligibility
  - API/public-surface eligibility
  - architecture relevance
  - low-signal config suppression
  - graph-preview eligibility
  - group id derivation
  - semantic kind inference
  - generic group penalties
- Refactored these modules to delegate to `ProjectPolicy`:
  - `src/server/shared/engine/core/file-classifier.ts`
  - `src/server/shared/engine/core/structure.ts`
  - `src/server/shared/engine/pipeline/documentation-input-context.ts`
  - `src/server/shared/engine/pipeline/report-helpers.ts`
  - `src/server/features/analyze-repo/model/mapper-skeleton.ts`
  - `src/server/entities/analyze/lib/semantics.ts`
  - `src/server/entities/analyze/lib/structure-shared.ts`
- Validation after wave:
  - `pnpm arch:check` stayed at the same baseline `6` violations
  - no new circulars or layer violations were introduced
  - filtered `tsc` on touched policy files is clean aside from existing environment dependency noise

## Wave 6
- Decompose type contracts and metric orchestration
- Add contextual logging to quiet fallback paths

### Wave 6 Result
- Decomposed `core/types.ts` into a re-export facade over:
  - `src/server/shared/engine/core/discovery.types.ts`
  - `src/server/shared/engine/core/documentation.types.ts`
  - `src/server/shared/engine/core/metrics.types.ts`
- Decomposed `code-metrics.ts` into:
  - `src/server/shared/engine/metrics/code-metric-formulas.ts`
  - `src/server/shared/engine/metrics/code-metric-scan.ts`
  - `src/server/shared/engine/metrics/code-metrics.ts` as orchestration entrypoint
- Added contextual debug logging to soft-swallow paths in:
  - `src/server/shared/engine/metrics/common-metrics.ts`
  - `src/server/shared/engine/extractors/language-signals.ts`
  - `src/server/shared/engine/extractors/openapi-inventory.ts`
  - `src/server/shared/engine/metrics/code-metrics.ts`
- Validation after wave:
  - `pnpm arch:check` remains at `6` violations (same known baseline)
  - filtered `tsc` on touched files is clean except for pre-existing missing package typings:
    - `@secretlint/core`
    - `@secretlint/secretlint-rule-preset-canary`
    - `sloc`
    - `simple-git`
