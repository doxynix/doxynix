# Phase 2B: Complete Metrics, Signals, Evidence Consolidation Plan

**Status**: Phase 2B-3 ✅ COMPLETE. Ready for Phase 2B-4 (Evidence Decomposition)

---

## CURRENT STATE ANALYSIS

### ✅ What's Already Consolidated (Phase 2A)
- **Scoring Constants**: All magic numbers in `scoring-constants.ts`
- **Signal collection**: All flow through single `RepositoryEvidence`
- **Module interface**: Unified file representation (Phase 2B-1)

### ✅ Phase 2B-2 COMPLETE - Metrics Hierarchy
**DONE**: Created BaseMetrics → RawMetrics/DerivedMetrics → HealthMetrics/RiskMetrics hierarchy
- BaseMetrics interface ensures all metrics track source and timestamp
- RiskMetrics consolidates old flat RiskRawMetrics + RiskDerivedScores into nested structure
- Backward compatibility: old type aliases remain for gradual migration
- ✅ TypeScript: 0 new metric errors

**Files Changed**:
- `src/server/shared/engine/core/types.ts` - Added metrics hierarchy

### ✅ Phase 2B-3 COMPLETE - Signal Base System
**DONE**: Created polymorphic signal hierarchy with BaseSignal interface
- BaseSignal interface: path, confidence, score, source (enum)
- FileSignals extends BaseSignal (extraction-time file analysis)
- HotspotSignal extends BaseSignal (architectural risk hotspots)
- SecuritySignal extends BaseSignal (security findings)
- All signal producers include confidence levels for audit trail

**Signal Producer Confidence Levels**:
- Regex-based extraction: 60% (fallback)
- Tree-sitter AST: 80% (good coverage)
- TypeScript compiler: 92% (highest fidelity)
- Risk model hotspots: 85% (structural analysis)

**Files Changed**:
- `src/server/shared/engine/core/types.ts` - Signal base hierarchy
- `src/server/shared/engine/core/evidence.ts` - buildHotspotSignals with base properties
- `src/server/shared/engine/extractors/regex-signals.ts` - Added base properties
- `src/server/shared/engine/extractors/tree-sitter-signals.ts` - Added base properties
- `src/server/shared/engine/extractors/typescript-signals.ts` - Added base properties
- `src/server/shared/engine/pipeline/documentation-input.ts` - Type-safe hotspot handling
- ✅ TypeScript: 0 Signal-related errors

### ⏳ Phase 2B-4 NEXT - RepositoryEvidence Decomposition
**To Come**: Split 15-property monolith into concern groups

#### 2.1: METRICS HIERARCHY (Priority: HIGH)
**Problem**:
- 4 separate flat metric types: `RepoMetrics`, `HealthScoreParams`, `RiskRawMetrics`, `RiskDerivedScores`
- `RiskRawMetrics` (8 count fields) and `RiskDerivedScores` (5 score fields) are separate but conceptually related
- `HealthScoreParams` is fragmented across repo + component files
- No common interface; each transformation loses type context

**Solution**: Create metrics hierarchy
```
BaseMetrics (common interface)
    ├─ RawMetrics (counts/observations)
    │   ├─ RiskRawMetrics (8 counts from evidence)
    │   └─ SecurityRawMetrics (security issue counts)
    ├─ DerivedMetrics (calculated, 0-100 scores)
    │   ├─ HealthMetrics (7 component scores → 1 health score)
    │   └─ RiskMetrics (5 categories → 1 overall risk score)
    └─ RepoMetrics (union of all metrics)
```

**Expected impact**:
- Eliminate 2 types (consolidate RiskRaw+RiskDerived)
- Unify scoring pipelines
- Type-safe metric transformations
- 15-20% reduction in type definition boilerplate

**Files to modify**:
1. `src/server/shared/engine/core/types.ts` - Add hierarchy
2. `src/server/shared/engine/metrics/code-metrics.ts` - Update metrics building
3. `src/server/shared/engine/core/risk-model.ts` - Update risk calculations
4. `src/server/features/analyze-repo/lib/types.ts` - Remove duplicates

---

#### 2.2: SIGNAL BASE SYSTEM (Priority: MEDIUM)
**Problem**:
- `FileSignals` (23 props), `HotspotSignal` (7 props), `SecurityFindingMetric` (4 props) have no inheritance
- Each signal type repeats: path, confidence, score
- No compiler guarantee that all signals have these core props

**Solution**: Create Signal base interface
```
interface Signal {
  path: string;
  confidence: number;
  score?: number;
  source: 'extraction' | 'analysis' | 'risk';
}

interface FileSignal extends Signal {
  analysisMode: ParseTier;
  apiSurface: number;
  exports: number;
  categories: FileCategory[];
  symbols: SymbolRef[];
  imports: string[];
  routes: RouteRef[];
  entrypointHints: EntrypointRef[];
  frameworkHints: FrameworkFact[];
}

interface HotspotSignal extends Signal {
  complexity: number;
  churnScore: number;
  inbound: number;
  outbound: number;
  categories: FileCategory[];
}
```

**Expected impact**:
- Polymorphic signal handling in RepositoryEvidence
- Easier to add new signal types
- Consistent query interface

**Files to modify**:
1. `src/server/shared/engine/core/types.ts` - Add Signal base
2. `src/server/shared/engine/core/structure.ts` - Update signal building

---

#### 2.3: REPOSITORY EVIDENCE DECOMPOSITION (Priority: HIGH)
**Problem**:
- `RepositoryEvidence` is a 15-property monolith:
  ```
  configs, dependencyCycles, dependencyGraph, entrypoints,
  fileCategoryBreakdown, frameworkFacts, hotspotSignals,
  modules, orphanModules, publicSurface, routeInventory,
  routes, symbols
  ```
- Mixing concerns: dependency graph, module metadata, route inventory, security config
- Difficult to reason about what "evidence" means
- Hard to extend without breaking type

**Solution**: Decompose by concern
```typescript
interface GraphEvidence {
  edges: DependencyEdge[];
  dependencyCycles: string[][];
  resolvedEdges: number;
  unresolvedEdges: number;
  orphanModules: string[];
}

interface ModuleEvidence {
  modules: ModuleRef[];
  publicSurface: SymbolRef[];
  frameworkFacts: FrameworkFact[];
  fileCategoryBreakdown: FileCategoryBreakdownItem[];
  hotspotSignals: HotspotSignal[];
}

interface SecurityEvidence {
  configs: ConfigRef[];
  securityFindings?: SecurityFindingMetric[];
}

interface RouteEvidence {
  routes: RouteRef[];
  routeInventory: RouteInventory;
}

// Composite type
interface RepositoryEvidence {
  graph: GraphEvidence;
  modules: ModuleEvidence;
  security: SecurityEvidence;
  routes: RouteEvidence;
}
```

**Expected impact**:
- 30% reduction in cognitive load per interface
- Easier to cache/invalidate pieces independently
- Type-safe evidence composition
- Self-documenting API (graph-related stuff is under .graph)

**Files to modify**:
1. `src/server/shared/engine/core/types.ts` - Decompose RepositoryEvidence
2. `src/server/shared/engine/core/evidence.ts` - Update assembly logic
3. All consumers of RepositoryEvidence (10-15 files)

---

## IMPLEMENTATION PHASES

### Phase 2B-2: Metrics Hierarchy
**Effort**: 2-3 hours
**Risk**: LOW (internal types only, no external API change)
**Steps**:
1. Create BaseMetrics interface in types.ts
2. Create RawMetrics, DerivedMetrics subtypes
3. Consolidate RiskRawMetrics + RiskDerivedScores into single RiskMetrics type
4. Update code-metrics.ts buildRepoMetrics()
5. Update risk-model.ts to use new types
6. Remove RepoMetrics from features/lib/types.ts (re-export from core)
7. Update all call sites
8. TypeScript verification

**Commits**:
- "refactor(metrics): create metrics hierarchy (base → raw → derived → repo)"

---

### Phase 2B-3: Signal Base System
**Effort**: 1-2 hours
**Risk**: LOW (additive, backward-compat with aliases)
**Steps**:
1. Create Signal base interface in types.ts
2. Create FileSignal, HotspotSignal, SecuritySignal as subtypes
3. Update extractors to use typed signals
4. Test that RepositoryEvidence compilation succeeds
5. Optional: Create SignalCollector utility for unified collection

**Commits**:
- "refactor(signals): introduce signal base interface hierarchy"

---

### Phase 2B-4: Evidence Decomposition
**Effort**: 3-4 hours
**Risk**: MEDIUM (widespread refactoring, easy to miss call sites)
**Steps**:
1. Create GraphEvidence, ModuleEvidence, SecurityEvidence, RouteEvidence in types.ts
2. Update RepositoryEvidence to use composite structure
3. Update evidence.ts collectRepositoryEvidence() to build new structure
4. Use codemods or systematic grep/replace for call sites:
   - evidence.modules → evidence.modules.modules
   - evidence.routes → evidence.routes.routes
   - evidence.dependencyCycles → evidence.graph.dependencyCycles
   - evidence.configs → evidence.security.configs
5. Test all 10-15 affected files
6. TypeScript verification

**Commits**:
- "refactor(evidence): decompose repository evidence by concern"
- "refactor(consumers): update evidence decomposition call sites"

---

## DELIVERABLES

### Per-phase:
1. **Updated types.ts** with new hierarchy
2. **Updated builders** (metrics, evidence)
3. **Updated consumers** (all call sites)
4. **TypeScript clean** (no new errors)
5. **Phase report** in MEMORY.md

### Final state:
- ✅ Metrics: 4 types → 1 hierarchy (backward-compat aliases)
- ✅ Signals: Inheritance-based, extensible
- ✅ Evidence: Goal-oriented decomposition
- ✅ All transformations type-safe
- ✅ Data flow clear and self-documenting

---

## RISK MITIGATION

| Risk | Mitigation |
|------|-----------|
| Breaking changes | Use type aliases, test all 20+ call sites before committing |
| Missed call sites | Use grep to find ALL usages of old types, verify systematically |
| TypeScript errors | Run tsc after each phase, fix errors before moving to next |
| Logic regression | No calculation changes, only data flow reorganization |
| Git conflicts | Commit small granular changes, don't batch all 3 phases |

---

## SUCCESS METRICS

- ✅ Zero new TypeScript errors related to metrics/signals/evidence
- ✅ All existing calculations produce identical results
- ✅ Type file size: no increase (actually decrease via consolidation)
- ✅ Call site count: reduction from refactoring
- ✅ Code review: self-documenting types require less explanation

---

**Next step**: Begin Phase 2B-2 (Metrics Hierarchy)
