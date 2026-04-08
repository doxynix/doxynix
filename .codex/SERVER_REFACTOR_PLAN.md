# Global Refactor Plan for `src/server`

## Current Status (Updated)
- [x] `entities -> features` boundary violations removed in `entities/analyze/lib/*`.
- [x] `AIResult` schema/types moved to shared source: `shared/engine/core/analysis-result.schemas.ts`.
- [x] `RepoMetrics` and related metric aliases unified to shared source in `shared/engine/core/metrics.types.ts`.
- [x] `repo-details.service` duplicate mapping logic collapsed to shared local mappers.
- [x] `github-api` fallback branching reduced via shared retry helpers.
- [x] Writers contracts (`WriterName`/`WriterStatus`/`WriterResult`) unified.
- [x] Writers task map keys typed (`WriterTaskKey`) and string-magic checks removed.
- [x] Writers orchestration `any` cleanup done (`RepositoryEvidence` type + removed `as any` runtime cast).
- [x] Removed dead writer-fallback output field (`updatedErrors`) and related noise.
- [ ] Remaining: consistency sweep across `shared/engine/core` naming clusters.
- [x] `repo-analysis.service` readability/safety pass done (unified access check + safer maintenance-status fallback).

## STOP Criteria (Hard)
Refactor is considered COMPLETE when all items below are true:

1) Boundary Integrity
- [x] No imports from `entities/*` into `features/*` internals in wrong direction (`entities -> features` forbidden).
- [x] No legacy contract imports from `features/analyze-repo/lib/{types,schemas}` in `src/server`.

2) Single Source of Truth
- [x] `AIResult` contracts come from `shared/engine/core/analysis-result.schemas.ts`.
- [x] `RepoMetrics` contracts come from `shared/engine/core/metrics.types.ts`.
- [x] Writer result/status/name contracts have one source (`writer-tasks.ts`).

3) Service Readability
- [x] `repo-analysis.service.ts` uses consistent access checks and no obvious high-value duplicate branches.
- [x] Writer orchestration flow has typed task keys and no string-magic checks.

4) Type Safety Baseline
- [x] No `any` in `features/analyze-repo/model/writers/*`.
- [x] No high-value `any` in `features/analyze-repo/api/repo-analysis.service.ts` (ignore low-value prompt/template internals).

5) Diminishing Returns Gate (Stop Rule)
- If the next 2 iterations produce only cosmetic edits (naming/ordering/comments) with no boundary, duplication, or type-safety win, STOP immediately.

## Final Sprint To STOP
- Pass A: `repo-analysis.service.ts` duplicate branch cleanup.
- Pass B: `shared/engine/core` naming consistency (only if semantic benefit is clear).
- Pass C: verify STOP checklist and freeze refactor wave.

## Verification Snapshot
- [x] `pnpm tsc --noEmit --pretty false --project tsconfig.json` passes (0 errors).
- [x] Core compatibility restored for `shared/engine/core/types.ts` consumers.

## 1) Stabilize Boundaries
- Enforce flow: `api/router -> feature service -> domain/entities -> shared/engine -> infrastructure`.
- Remove remaining layer bypasses and hidden entrypoints.
- Done when imports and call chains match intended layers.

## 2) Remove Passthrough and Semantic Duplicates
- Delete wrappers that only delegate with no value.
- Consolidate duplicated decision logic (scoring/filtering/normalization).
- Done when each decision class has one source of truth.

## 3) Analyze Domain Cleanup (`entities/analyze`)
- Normalize responsibilities across:
  - `analyze-context-builder`
  - `graph-navigator`
  - `node-explainer`
  - `node-inspection`
  - `structure-context`
- Remove duplicate payload mapping and repeated calculations.
- Done when flow `repo -> context -> map/node -> explain` reads linearly.

## 4) GitHub Infrastructure Cleanup
- Finalize roles for:
  - `github-provider` (auth/client resolution)
  - `github-api` (GitHub operations + fallback mechanics)
  - `github-app.service` (dashboard/install use-cases)
  - `github-browse.service` (browse-facing use-cases)
  - `git.ts` (analysis clone/auth context)
- Done when shared auth/error/fallback helpers are centralized.

## 5) Feature Service Hardening
- Refine `features/analyze-repo/api/repo-analysis.service.ts` and related writer/task modules.
- Keep orchestration in services, move reusable logic to focused helpers.
- Done when trigger/meta/response patterns are not duplicated.

## 6) Naming and File Responsibility Pass
- Eliminate ambiguous names and mixed-purpose modules.
- Colocate single-module types/constants/functions where appropriate.
- Done when each filename clearly maps to one responsibility.

## 7) Final Consistency Sweep
- Resolve remaining import inconsistencies and style drift.
- Remove leftover technical debt from migration steps.
- Done when architecture is coherent and predictable end-to-end.
