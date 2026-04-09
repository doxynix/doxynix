# Policy Consolidation Plan

## Goal

Create one semantic center for repository-discovery decisions so the backend answers the same way to these questions everywhere:

- Is this file an entrypoint?
- Is this path part of the public API?
- Is this file architecturally relevant or just noise?
- What semantic role does this path/group play?
- Is this file low-signal config/build noise?
- Should this path appear in structure, docs, graph preview, or explain flows?

## Current Heuristic Spread

### `src/server/shared/engine/core/file-classifier.ts`

Owns path/file policy today:

- `isLowSignalConfigFile`
- `isLikelyBarrelFile`
- `isUsefulComplexityCandidate`
- `isPrimaryContourExcluded`
- `isRuntimeSourceFile`
- `isArchitectureRelevant`
- `isPrimaryEntrypointFile`
- `isPrimaryApiEvidenceFile`
- `isCoreFrameworkFactSource`

Problem:
- high-value source of truth, but not actually the only source of truth
- some decisions are duplicated downstream with extra regexes and penalties

### `src/server/shared/engine/core/patterns.ts`

Owns raw path patterns:

- API
- CONFIG
- IGNORE
- INFRA
- ENTRY
- RUNTIME_SOURCE
- SENSITIVE
- TEST
- TOOLING

Problem:
- declarative data exists here, but not all downstream heuristics actually delegate to it

### `src/server/shared/engine/core/structure.ts`

Owns graph-preview admission policy:

- `isGraphPreviewCandidate`

Problem:
- duplicates “noise suppression” logic already present in `file-classifier`
- graph visibility policy is not clearly separated from base path classification

### `src/server/entities/analyze/lib/semantics.ts`

Owns path grouping and semantic-role heuristics:

- `GROUPING_ROOTS`
- `JVM_SOURCE_ROOTS`
- `POLYGLOT_CONFIG_HINTS`
- `GENERIC_GROUP_ROOTS`
- `deriveGroupId`
- `collectSemanticKinds`
- `getStructureSeedScore`
- group penalty / ranking logic

Problem:
- semantic-role policy lives outside engine
- grouping/semantic rules partly overlap with classifier decisions
- regexes duplicate path intent already represented in engine patterns

### `src/server/shared/engine/pipeline/documentation-input-context.ts`

Owns docs-focused filtering policy:

- entrypoint filtering
- API-route filtering
- architecture-module selection

Problem:
- docs pipeline still makes policy decisions instead of calling one discovery policy API

### Additional spread found during audit

- `src/server/shared/engine/core/evidence-derived.ts`
  - entrypoint inference depends on duplicated “primary entrypoint” and “architecture relevant” policy
- `src/server/shared/engine/pipeline/report-helpers.ts`
  - has its own `isArchitectureRelevantModule`
- `src/server/features/analyze-repo/model/mapper-skeleton.ts`
  - has its own `isArchitectureRelevantModule`
- `src/server/features/file-actions/model/file-actions.ts`
  - low-signal suppression partly repeats classifier intent at action layer

## Centralization Target

Introduce:

- `src/server/shared/engine/core/project-policy-rules.ts`
  - declarative rule tables only
- `src/server/shared/engine/core/project-policy.ts`
  - executable policy API only

## Proposed ProjectPolicy API

### Path classification

- `ProjectPolicy.classifyPath(path)`
- `ProjectPolicy.getCategories(path)`
- `ProjectPolicy.getPrimaryCategory(path)`
- `ProjectPolicy.isIgnored(path)`
- `ProjectPolicy.isSensitive(path)`
- `ProjectPolicy.isGenerated(path)`
- `ProjectPolicy.isLowSignalConfig(path)`

### Discovery decisions

- `ProjectPolicy.isRuntimeSource(path)`
- `ProjectPolicy.isArchitectureRelevant(path)`
- `ProjectPolicy.isEntrypointCandidate(path)`
- `ProjectPolicy.isPrimaryEntrypoint(path)`
- `ProjectPolicy.isPrimaryApiSurface(path, options?)`
- `ProjectPolicy.isFrameworkFactSource(path)`
- `ProjectPolicy.isGraphPreviewCandidate(path)`
- `ProjectPolicy.isStructureCandidate(path, options?)`

### Grouping / semantic role

- `ProjectPolicy.deriveGroupId(path)`
- `ProjectPolicy.getGroupLabel(groupId)`
- `ProjectPolicy.getSemanticKinds(path, options?)`
- `ProjectPolicy.getPrimarySemanticKind(counts)`
- `ProjectPolicy.getGenericGroupPenalty(groupId)`

### Policy explainability

- `ProjectPolicy.explainPathDecision(path)`
- `ProjectPolicy.explainGroupDecision(groupId)`

These should return machine-readable reasons, not prose-only strings.

## Boundary Rules

### Must stay in engine

- deterministic path/file classification
- grouping rules
- semantic role inference
- graph-preview eligibility
- API/public-surface eligibility
- entrypoint candidacy
- structure/noise admission rules

### Must not live in engine

- UI-facing ranking prose
- inspect panel wording
- recommended actions
- frontend-oriented display labels beyond neutral semantic labels

### Entity layer may consume, not redefine

- `entities/analyze/lib/semantics.ts`
- `entities/analyze/lib/analysis-utils.ts`
- `entities/analyze/lib/graph-navigator.ts`

These modules should ask policy questions, not own policy.

## Refactor Order

### Phase A

- create `project-policy-rules.ts`
- create `project-policy.ts`
- migrate raw regex/path heuristics from:
  - `file-classifier.ts`
  - `semantics.ts`
  - `structure.ts`

### Phase B

- refactor `file-classifier.ts` into a thin adapter over `ProjectPolicy`
- refactor `structure.ts` to remove local candidate rules
- refactor `documentation-input-context.ts` to ask policy for entry/API filtering

### Phase C

- refactor `semantics.ts` so it owns ranking, not base path policy
- keep only analyze-specific scoring and graph/node ranking there

### Phase D

- remove duplicated `isArchitectureRelevantModule` style checks from:
  - `report-helpers.ts`
  - `mapper-skeleton.ts`

## Success Criteria

- one place to change “what counts as entrypoint/API/architecture/noise”
- no repeated regexes for API/role/path grouping across server layers
- engine owns policy, entity/pipeline/features consume it
- `arch:check` does not regress
- behavior stays stable on existing repos
