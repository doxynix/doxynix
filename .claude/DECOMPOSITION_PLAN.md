# Phase 3: Code Modularization & Logical Consolidation - DECOMPOSITION PLAN

**Status**: Discovery Phase COMPLETE. Ready for Execution.
**Date**: 2026-04-08
**Target**: 9 oversized files → 24+ modular files | 180+ duplicate lines eliminated

---

## EXECUTIVE SUMMARY

Backend audit identified **9 critical files > 500 lines** requiring decomposition:

| Priority | File | Lines | Complexity | Action |
|----------|------|-------|-----------|--------|
| 🔴 **P0** | `ai-pipeline.ts` | 865 | 32 branches | Split into 4 modules |
| 🔴 **P0** | `github.service.ts` | 641 | 34 branches | Split into 5 modules |
| 🔴 **P0** | `documentation-input.ts` | 607 | 34 branches | Split into 6 modules |
| 🟠 **P1** | `types.ts` | 719 | 1 (pure types) | Organize into 6 files |
| 🟠 **P1** | `evidence.ts` | 570 | 28 branches | Split into 5 modules |
| 🟠 **P1** | `code-metrics.ts` | 588 | 12 branches | Split into 5 modules |
| 🟡 **P2** | `artifacts.ts` | 531 | 8 branches | Split into 2 modules |
| 🟡 **P2** | `analysis-utils.ts` | 518 | 6 branches | Extract helpers + types |
| 🟡 **P2** | `semantics.ts` | 516 | 4 branches | Extract rule sets |

**Logical Duplicates Found:**
- `collectRoutes()` (95% identical, 2 locations)
- Symbol collection (70% similar, 3 variations)
- Path operations (40+ repetitions across 4 files)
- Filter builders (70% template similarity)

**Consolidation Targets:**
- Extract 5 reusable collectors to `shared/lib/collectors/`
- Create 8 utility modules in `shared/lib/`
- Eliminate ~180 lines of duplicate logic

---

## CRITICAL DUPLICATES (HIGH PRIORITY TO CONSOLIDATE)

### 1. **collectRoutes() - 95% IDENTICAL**

**Location 1**: `src/server/shared/engine/extractors/tree-sitter-signals.ts` (line ~180)
```typescript
export const collectRoutes = (file: RepositoryFile, spec: LanguageSpec): RouteRef[] => {
  return spec.routes
    .flatMap(pattern => findMatches(file.path, file.content, pattern))
    .map(match => buildRouteRef(match, "tree-sitter", 80))
    .filter(route => isValidRoute(route))
    .slice(0, MAX_ROUTES);
};
```

**Location 2**: `src/server/shared/engine/extractors/regex-signals.ts` (line ~160)
```typescript
export const collectRoutes = (filePath: string, content: string, patterns: RegexRoutePattern[]): RouteRef[] => {
  return patterns
    .flatMap(pattern => matchPattern(content, pattern.regex))
    .map(match => buildRouteRef(match, "regex", 60))
    .filter(route => isValidRoute(route))
    .slice(0, MAX_ROUTES);
};
```

**Issue**: 95% identical logic; only differs in pattern matching library (tree-sitter vs regex)

**Solution**:
- Create `shared/lib/collectors/route-collector.ts`
- Extract interface `RoutePatternMatcher` with implementations for tree-sitter and regex
- Single `collectRoutes()` taking strategy pattern

---

### 2. **Symbol Collection - 70% SIMILAR (3 variants)**

**Location 1**: `src/server/shared/engine/extractors/regex-signals.ts` → `collectSymbols()`
```typescript
const symbols = patterns.exports
  .flatMap(pattern => matchPattern(content, pattern.regex))
  .map(match => buildSymbolRef(...))
  .slice(0, MAX_SYMBOLS);
```

**Location 2**: `src/server/shared/engine/extractors/tree-sitter-signals.ts` → embedded in `buildSignals()`
```typescript
// Similar filtering + building pattern, tree-sitter variant
```

**Location 3**: `src/server/shared/engine/extractors/typescript-signals.ts` → implicit in AST walk
```typescript
compiler.forEach(node => {
  if (isExportDeclaration(node)) {
    symbols.push(buildSymbolRef(node, "typescript", 92));
  }
});
```

**Issue**: All iterate, filter, build SymbolRef[], apply confidence

**Solution**:
- Create abstract `src/server/shared/lib/collectors/symbol-collector.ts`
- Define `SymbolExtractor` interface (regex, tree-sitter, typescript)
- Single entry point handling all 3 variants

---

### 3. **Path Filtering Chains - 40+ REPETITIONS**

**Pattern 1** (found in 4 files):
```typescript
const normalizedPaths = paths
  .map(p => normalizeRepoPath(p))
  .filter((p, i, arr) => arr.indexOf(p) === i)  // unique
  .slice(0, MAX_COUNT);
```

**Pattern 2** (found in signals.ts, analysis-utils.ts, graph-navigator.ts):
```typescript
const filtered = evidence.items
  .filter(item => allowedPaths.has(item.path))
  .map(item => normalizeRepoPath(item.path))
  .slice(0, MAX_COUNT);
```

**Pattern 3** (found in evidence.ts, semantics.ts):
```typescript
const deduped = Array.from(new Set(items.map(i => i.path)))
  .slice(0, LIMIT);
```

**Issue**: Same logic repeated 40+ times with variations

**Solution**:
- Create `src/server/shared/lib/path-operations.ts` with:
  - `normalizePathsInSet(paths, maxCount?): string[]`
  - `filterPathsBySet(paths, allowSet, maxCount?): string[]`
  - `deduplicatePaths(paths, maxCount?): string[]`

**Expected Reduction**: ~40 lines eliminated

---

## DECOMPOSITION STRATEGY

### **Priority 0 (IMMEDIATE) - Highest Complexity Files**

#### **1. ai-pipeline.ts → 4 modules**

**Current Structure** (865 lines):
- Lines 1-50: Imports
- Lines 50-310: Helper functions (8 utilities)
- Lines 313-470: `runAiPipeline()` stage orchestration
- Lines 473-865: `generateDeepDocs()` writer orchestration

**Target Structure**:

```
src/server/features/analyze-repo/model/
├── ai-pipeline.ts (200 lines) - Main orchestrator + public API
├── stages/
│  ├── sentinel-stage.ts (80 lines) - Sentinel execution
│  ├── mapper-stage.ts (80 lines) - Mapper execution
│  └── architect-stage.ts (80 lines) - Architect execution
├── writers/
│  ├── writer-orchestrator.ts (150 lines) - 5 writer coordination
│  └── writer-tasks/ (75 lines each)
│     ├── readme-writer.ts
│     ├── api-writer.ts
│     ├── contributing-writer.ts
│     ├── changelog-writer.ts
│     └── architecture-writer.ts
└── utils/
   ├── fallback-builders.ts (60 lines)
   ├── debug-snapshot.ts (40 lines)
   └── pipeline-context.ts (50 lines)
```

**Extraction Steps**:
1. Extract `runAiPipeline()` body → `stages/` (3 files, one per stage)
2. Extract writer loop logic → `writers/writer-orchestrator.ts`
3. Each writer task → separate file in `writers/writer-tasks/`
4. Helpers → `utils/` (fallback, debug, context)

**Benefits**:
- Cyclomatic complexity: 32 → 6-8 per file
- Parallel testing possible
- Easier to add new stages/writers

**Estimate**: 4-5 hours

---

#### **2. github.service.ts → 5 modules**

**Current Structure** (641 lines):
- Auth branches (lines ~40-120)
- Repo operations (lines ~125-250)
- Content operations (lines ~255-380)
- Commit operations (lines ~385-500)
- Main service facade (lines ~505-641)

**Target Structure**:

```
src/server/shared/infrastructure/github/
├── github.service.ts (80 lines) - Facade only
├── github-auth.ts (120 lines) - Auth context + token management
├── github-repos.ts (140 lines) - Repo listing/fetching
├── github-content.ts (180 lines) - File/directory operations
└── github-commits.ts (100 lines) - Commit/PR history
```

**Extraction Steps**:
1. Extract auth context creation → `github-auth.ts`
2. Extract repo operations → `github-repos.ts`
3. Extract file/content operations → `github-content.ts`
4. Extract commit operations → `github-commits.ts`
5. Keep main file as facade

**Benefits**:
- Cyclomatic complexity: 34 → 8-12 per file
- Clear separation of concerns
- Easier to mock/test

**Estimate**: 3-4 hours

---

#### **3. documentation-input.ts → 6 modules**

**Current Structure** (607 lines):
- Helper builders (lines 44-192)
- 5 section builders (lines 193-505)
- Main orchestrator (lines 509-607)

**Target Structure**:

```
src/server/shared/engine/pipeline/documentation-input/
├── documentation-input.ts (120 lines) - Orchestrator
├── helpers/
│  ├── framework-facts.ts (40 lines)
│  ├── entrypoints.ts (30 lines)
│  └── routes-inventory.ts (50 lines)
└── sections/
   ├── overview-section.ts (100 lines)
   ├── architecture-section.ts (100 lines)
   ├── api-section.ts (120 lines)
   ├── risks-section.ts (120 lines)
   └── onboarding-section.ts (80 lines)
```

**Extraction Steps**:
1. Create `sections/` directory
2. Move each section builder to own file
3. Extract helpers to `helpers/`
4. Keep main file as orchestrator

**Benefits**:
- Cyclomatic complexity: 34 → 8-10 per file
- Each section independently maintainable
- Easier to add new sections

**Estimate**: 3 hours

---

### **Priority 1 (PHASE 2) - High Complexity + Duplication**

#### **4. evidence.ts → 5 modules**

**Target Structure**:

```
src/server/shared/engine/core/evidence/
├── evidence.ts (150 lines) - Main orchestrator
├── dependency-graph-builder.ts (150 lines)
├── module-evidence-builder.ts (140 lines)
├── route-evidence-builder.ts (80 lines)
├── hotspot-builder.ts (100 lines)
└── signal-builders.ts (100 lines)
```

**Key Consolidations**:
- Extract `deduplicatePaths()` calls → use new `path-operations.ts`
- Extract symbol deduplication → use new `symbol-collector.ts`

**Estimate**: 3-4 hours

---

#### **5. code-metrics.ts → 5 modules**

**Target Structure**:

```
src/server/shared/engine/metrics/
├── code-metrics.ts (120 lines) - Orchestrator
├── file-scanner.ts (150 lines) - Per-file scan logic
├── score-normalizers.ts (100 lines) - Complexity + security normalization
├── language-metrics.ts (90 lines) - Language stats + sloc
└── duplication-detector.ts (120 lines) - Duplication calc
```

**Estimate**: 3 hours

---

### **Priority 1.5 (PARALLEL) - Type Organization**

#### **6. types.ts → 6 organized files** (NO LINE REDUCTION - just organization)

**Current**: 719 lines in one file (57 exports)

**Target Structure**:

```
src/server/shared/engine/core/types/
├── core-types.ts (70 lines) - Module, RepositoryFile, ParseTier, FileCategory
├── signal-types.ts (120 lines) - All signal interfaces
├── evidence-types.ts (180 lines) - Evidence groupings + RepositoryEvidence
├── metrics-types.ts (150 lines) - All *Metrics types
├── report-types.ts (100 lines) - Report section inputs/bodies
└── artifact-types.ts (50 lines) - ArtifactBuildParams/Result
```

**Key Decision**: Keep main `types.ts` as re-export facade for backward compatibility

```typescript
// src/server/shared/engine/core/types.ts
export * from "./types/core-types";
export * from "./types/signal-types";
export * from "./types/evidence-types";
export * from "./types/metrics-types";
export * from "./types/report-types";
export * from "./types/artifact-types";
```

**No breaking changes**; all imports from `./types` continue working

**Estimate**: 2 hours

---

### **Priority 2 (PHASE 3) - Medium Complexity**

#### **7. artifacts.ts → 2 modules**

**Split**:
- `artifacts-builders.ts` (300 lines) - Fact/Finding builders
- `artifacts.ts` (230 lines) - Orchestrator

**Estimate**: 2 hours

---

### **Priority 3 (CLEANUP) - Utility Consolidation**

#### **8. New Shared Utilities to Create**

**Files to Create** in `src/server/shared/lib/`:

```
src/server/shared/lib/
├── collectors/
│  ├── symbol-collector.ts (80 lines) - Polymorphic symbol extraction
│  ├── route-collector.ts (70 lines) - Polymorphic route extraction
│  └── import-collector.ts (60 lines) - Import collection utils
├── path-operations.ts (50 lines) - Normalization + deduplication
├── filter-builders.ts (40 lines) - Common filter patterns
└── deduplication.ts (50 lines) - Generic deduplication helpers
```

**Impact**: Enables 40+ duplicate lines to be replaced with imports

**Estimate**: 2 hours

---

## EXECUTION TIMELINE

| Phase | Target Files | Effort | Dependencies |
|-------|--------------|--------|---|
| **Phase 3.0 (P0)** | ai-pipeline, github.service, documentation-input | 12-13h | None |
| **Phase 3.1 (P1)** | types (org), evidence, code-metrics | 8-10h | Phase 3.0 complete |
| **Phase 3.2 (P1.5)** | artifacts, analysis-utils | 4-5h | Phase 3.1 complete |
| **Phase 3.3 (P3 Cleanup)** | Create shared collectors/utils | 2-3h | All phases |
| **Phase 3.4 (Verification)** | TypeScript compilation + tests | 2-3h | All splits complete |

**Total Effort**: ~30-35 hours (4-5 days)

---

## CONSOLIDATION CHECKLIST

### **Duplicate Elimination Tasks**

- [ ] Extract `collectRoutes()` to `shared/lib/collectors/route-collector.ts`
  - Update tree-sitter-signals.ts to import
  - Update regex-signals.ts to import
  - Remove 40 duplicate lines

- [ ] Extract symbol collection to `shared/lib/collectors/symbol-collector.ts`
  - Update 3 extractor files
  - Remove ~30 duplicate lines

- [ ] Extract path operations to `shared/lib/path-operations.ts`
  - Update 4 files (signals.ts, analysis-utils.ts, graph-navigator.ts, evidence.ts)
  - Remove ~40 duplicate lines

- [ ] Extract filter builders to `shared/lib/filter-builders.ts`
  - Update documentation-input.ts, artifacts.ts, risk-model.ts
  - Remove ~20 duplicate lines

### **File Decomposition Tasks**

- [ ] **ai-pipeline.ts**: Split into 4 modules (stages + writers + utils)
- [ ] **github.service.ts**: Split into 5 modules (auth + repos + content + commits + facade)
- [ ] **documentation-input.ts**: Split into 6 modules (orchestrator + 5 sections + helpers)
- [ ] **evidence.ts**: Split into 5 modules (orchestrator + 4 builders)
- [ ] **code-metrics.ts**: Split into 5 modules (orchestrator + 4 calculators)
- [ ] **types.ts**: Organize into 6 files (maintain facade export)
- [ ] **artifacts.ts**: Split into 2 modules
- [ ] **analysis-utils.ts**: Extract helpers into shared lib

### **Verification Tasks**

- [ ] Run TypeScript compilation: Zero new errors
- [ ] Verify all imports still work (backward compatibility)
- [ ] Run existing tests: All pass
- [ ] Cyclomatic complexity check: All new files < 15 branches
- [ ] Average file size: Target 150-250 lines

---

## SUCCESS METRICS

| Metric | Before | Target | Achievement |
|--------|--------|--------|---|
| **Max file size** | 865 lines | <250 lines | Reduce by 71% |
| **Files > 500 lines** | 9 files | 0 files | Eliminate oversized files |
| **Avg cyclomatic complexity** | 18 branches | 8 branches | Reduce by 56% |
| **Duplicate logic** | 180 lines | <20 lines | Eliminate 89% |
| **Total files** | 4 (monolithic) | 24+ (modular) | Increase modularity |
| **Testability** | Hard | High | More unit testable functions |

---

## RISK MITIGATION

| Risk | Mitigation |
|------|-----------|
| Breaking changes | Keep main files as re-export facades (types.ts) |
| Import chaos | Update all internal imports systematically |
| Missed duplicates | Use grep patterns to verify consolidation |
| TypeScript errors | Run typecheck after each major split |
| Git conflicts | Commit small splits incrementally |

---

## NOTES FOR EXECUTION

1. **FSD Boundaries**: All new `shared/lib/collectors/` stay in Shared layer; no features outside
2. **Backward Compatibility**: Main facade files re-export all modules; no external code needs updates
3. **Parallel Work**: Phases 3.0, 3.1, 3.2 can overlap once P0 phase completes
4. **Testing Strategy**: No behavior changes, only organization → existing tests should pass
5. **DRY Principle**: Every consolidation eliminates duplicate lines; track savings

---

## DELIVERABLES

✅ DECOMPOSITION_PLAN.md (this file)
⏳ Phase 3.0: P0 file splits (ai-pipeline, github, documentation-input)
⏳ Phase 3.1: P1 file splits (evidence, code-metrics, types organization)
⏳ Phase 3.2: P2 file splits (artifacts, analysis-utils, shared collectors)
⏳ Phase 3.3: Consolidation completion report
⏳ Phase 3.4: Verification report (zero new TypeScript errors, test pass)

---

**Status**: Ready for Phase 3.0 execution
**Estimated Duration**: 4-5 days (part-time)
**Complexity**: Medium (well-scoped, clear dependencies)
**Impact**: High (significantly improves codebase maintainability)
